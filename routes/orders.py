from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timedelta, UTC
from flask import Blueprint, request, jsonify
from database.mongodb import db

order_bp = Blueprint("orders", __name__)
orders = db.orders
products = db.products

VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"]
VALID_PAYMENT_STATUSES = ["unpaid", "paid", "refunded"]
VALID_PAYMENT_METHODS = ["upi", "cod"]
VALID_SOURCES = ["admin", "storefront"]
HISTORY_CUTOFF_DAYS = 7


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


def to_number(value, cast=float, default=0):
    try:
        return cast(value)
    except (TypeError, ValueError):
        return default


def compute_total(items):
    total = 0
    for item in items:
        total += to_number(item.get("price")) * to_number(item.get("qty"), int, 0)
    return round(total, 2)


def next_order_number():
    last = orders.find_one(sort=[("order_no", -1)])
    return (last.get("order_no", 1000) if last else 1000) + 1


def check_stock_availability(items):
    """Returns the name of the first item that doesn't have enough stock,
    or None if every item (that references a real product_id) is available.
    Items without a product_id (e.g. manually typed by an admin) are skipped.
    """
    for item in items:
        pid = item.get("product_id")
        if not pid:
            continue
        try:
            product = products.find_one({"_id": ObjectId(pid)})
        except InvalidId:
            continue
        if not product:
            continue
        available = to_number(product.get("stock"), int, 0)
        requested = to_number(item.get("qty"), int, 0)
        if requested > available:
            return item.get("name") or product.get("name") or "an item"
    return None


def decrement_stock(items):
    """Best-effort stock decrement for items that reference a real product.
    Not restored automatically if the order is later cancelled/deleted —
    that's a manual admin step for now (see README)."""
    for item in items:
        pid = item.get("product_id")
        if not pid:
            continue
        qty = to_number(item.get("qty"), int, 0)
        if qty <= 0:
            continue
        try:
            products.update_one({"_id": ObjectId(pid)}, {"$inc": {"stock": -qty}})
        except InvalidId:
            continue


# -------------------------------
# CREATE ORDER
# -------------------------------
@order_bp.route("/api/orders", methods=["POST"])
def add_order():
    data = request.json or {}

    if not data.get("customer_name"):
        return jsonify({"success": False, "message": "Customer name is required"}), 400

    items = data.get("items") or []
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"success": False, "message": "Order must include at least one item"}), 400

    out_of_stock_item = check_stock_availability(items)
    if out_of_stock_item:
        return jsonify({
            "success": False,
            "message": f"Not enough stock available for '{out_of_stock_item}'"
        }), 400

    order = {
        "order_no": next_order_number(),
        "customer_name": data.get("customer_name", "").strip(),
        "customer_id": data.get("customer_id") or None,
        "phone": data.get("phone", "").strip(),
        "address": data.get("address", "").strip(),
        "items": items,
        "total": compute_total(items),
        "status": data.get("status") if data.get("status") in VALID_STATUSES else "pending",
        "payment_status": data.get("payment_status") if data.get("payment_status") in VALID_PAYMENT_STATUSES else "unpaid",
        "payment_method": data.get("payment_method") if data.get("payment_method") in VALID_PAYMENT_METHODS else "cod",
        "source": data.get("source") if data.get("source") in VALID_SOURCES else "admin",
        "notes": data.get("notes", "").strip(),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }

    result = orders.insert_one(order)
    decrement_stock(items)

    return jsonify({
        "success": True,
        "message": "Order created successfully",
        "id": str(result.inserted_id),
        "order_no": order["order_no"]
    }), 201


# -------------------------------
# GET ALL ORDERS (optional ?status=&q=)
# -------------------------------
@order_bp.route("/api/orders", methods=["GET"])
def get_orders():
    status = request.args.get("status")
    query = request.args.get("q")
    view = request.args.get("view", "active")

    mongo_filter = {}
    if status and status != "all":
        mongo_filter["status"] = status
    if query:
        mongo_filter["$or"] = [
            {"customer_name": {"$regex": query, "$options": "i"}},
            {"phone": {"$regex": query, "$options": "i"}},
        ]

    cutoff = datetime.now(UTC) - timedelta(days=HISTORY_CUTOFF_DAYS)
    if view == "history":
        mongo_filter["created_at"] = {"$lt": cutoff}
    else:
        mongo_filter["created_at"] = {"$gte": cutoff}

    all_orders = [serialize(o) for o in orders.find(mongo_filter).sort("created_at", -1)]
    return jsonify(all_orders)


# -------------------------------
# GET SINGLE ORDER
# -------------------------------
@order_bp.route("/api/orders/<id>", methods=["GET"])
def get_order(id):
    try:
        order = orders.find_one({"_id": ObjectId(id)})
    except InvalidId:
        return jsonify({"message": "Invalid order id"}), 400

    if not order:
        return jsonify({"message": "Order not found"}), 404

    return jsonify(serialize(order))


# -------------------------------
# UPDATE ORDER (details)
# -------------------------------
@order_bp.route("/api/orders/<id>", methods=["PUT"])
def update_order(id):
    data = request.json or {}

    update_fields = {"updated_at": datetime.now(UTC)}

    if "customer_name" in data:
        update_fields["customer_name"] = data.get("customer_name", "").strip()
    if "phone" in data:
        update_fields["phone"] = data.get("phone", "").strip()
    if "address" in data:
        update_fields["address"] = data.get("address", "").strip()
    if "items" in data and isinstance(data["items"], list):
        update_fields["items"] = data["items"]
        update_fields["total"] = compute_total(data["items"])
    if "notes" in data:
        update_fields["notes"] = data.get("notes", "").strip()
    if "status" in data and data["status"] in VALID_STATUSES:
        update_fields["status"] = data["status"]
    if "payment_status" in data and data["payment_status"] in VALID_PAYMENT_STATUSES:
        update_fields["payment_status"] = data["payment_status"]
    if "payment_method" in data and data["payment_method"] in VALID_PAYMENT_METHODS:
        update_fields["payment_method"] = data["payment_method"]

    try:
        result = orders.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    except InvalidId:
        return jsonify({"success": False, "message": "Invalid order id"}), 400

    if result.matched_count == 0:
        return jsonify({"success": False, "message": "Order not found"}), 404

    return jsonify({"success": True, "message": "Order updated successfully"})


# -------------------------------
# QUICK STATUS UPDATE
# -------------------------------
@order_bp.route("/api/orders/<id>/status", methods=["PATCH"])
def update_status(id):
    data = request.json or {}
    status = data.get("status")

    if status not in VALID_STATUSES:
        return jsonify({"success": False, "message": "Invalid status value"}), 400

    try:
        result = orders.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"status": status, "updated_at": datetime.now(UTC)}}
        )
    except InvalidId:
        return jsonify({"success": False, "message": "Invalid order id"}), 400

    if result.matched_count == 0:
        return jsonify({"success": False, "message": "Order not found"}), 404

    return jsonify({"success": True, "message": f"Order marked as {status}"})


# -------------------------------
# DELETE ORDER
# -------------------------------
@order_bp.route("/api/orders/<id>", methods=["DELETE"])
def delete_order(id):
    try:
        result = orders.delete_one({"_id": ObjectId(id)})
    except InvalidId:
        return jsonify({"success": False, "message": "Invalid order id"}), 400

    if result.deleted_count == 0:
        return jsonify({"success": False, "message": "Order not found"}), 404

    return jsonify({"success": True, "message": "Order deleted successfully"})