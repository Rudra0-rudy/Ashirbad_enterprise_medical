from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, UTC
from flask import Blueprint, request, jsonify
from database.mongodb import db

customer_bp = Blueprint("customers", __name__)
customers = db.customers
orders = db.orders


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


# -------------------------------
# ADD CUSTOMER
# -------------------------------
@customer_bp.route("/api/customers", methods=["POST"])
def add_customer():
    data = request.json or {}

    if not data.get("name"):
        return jsonify({"success": False, "message": "Customer name is required"}), 400

    customer = {
        "name": data.get("name", "").strip(),
        "business_name": data.get("business_name", "").strip(),
        "email": data.get("email", "").strip(),
        "phone": data.get("phone", "").strip(),
        "gst_number": data.get("gst_number", "").strip(),
        "address": data.get("address", "").strip(),
        "status": data.get("status") if data.get("status") in ["active", "blocked"] else "active",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }

    result = customers.insert_one(customer)

    return jsonify({
        "success": True,
        "message": "Customer added successfully",
        "id": str(result.inserted_id)
    }), 201


# -------------------------------
# GET ALL CUSTOMERS (with order summary)
# -------------------------------
@customer_bp.route("/api/customers", methods=["GET"])
def get_customers():
    query = request.args.get("q")

    mongo_filter = {}
    if query:
        mongo_filter["$or"] = [
            {"name": {"$regex": query, "$options": "i"}},
            {"business_name": {"$regex": query, "$options": "i"}},
            {"email": {"$regex": query, "$options": "i"}},
            {"phone": {"$regex": query, "$options": "i"}},
        ]

    all_customers = [serialize(c) for c in customers.find(mongo_filter).sort("created_at", -1)]

    for customer in all_customers:
        customer_orders = list(orders.find({"customer_name": customer["name"]}))
        customer["total_orders"] = len(customer_orders)
        customer["total_spent"] = round(sum(o.get("total", 0) for o in customer_orders), 2)

    return jsonify(all_customers)


# -------------------------------
# GET SINGLE CUSTOMER
# -------------------------------
@customer_bp.route("/api/customers/<id>", methods=["GET"])
def get_customer(id):
    try:
        customer = customers.find_one({"_id": ObjectId(id)})
    except InvalidId:
        return jsonify({"message": "Invalid customer id"}), 400

    if not customer:
        return jsonify({"message": "Customer not found"}), 404

    return jsonify(serialize(customer))


# -------------------------------
# UPDATE CUSTOMER
# -------------------------------
@customer_bp.route("/api/customers/<id>", methods=["PUT"])
def update_customer(id):
    data = request.json or {}

    update_fields = {
        "name": data.get("name", "").strip(),
        "business_name": data.get("business_name", "").strip(),
        "email": data.get("email", "").strip(),
        "phone": data.get("phone", "").strip(),
        "gst_number": data.get("gst_number", "").strip(),
        "address": data.get("address", "").strip(),
        "updated_at": datetime.now(UTC),
    }
    if data.get("status") in ["active", "blocked"]:
        update_fields["status"] = data["status"]

    try:
        result = customers.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    except InvalidId:
        return jsonify({"success": False, "message": "Invalid customer id"}), 400

    if result.matched_count == 0:
        return jsonify({"success": False, "message": "Customer not found"}), 404

    return jsonify({"success": True, "message": "Customer updated successfully"})


# -------------------------------
# DELETE CUSTOMER
# -------------------------------
@customer_bp.route("/api/customers/<id>", methods=["DELETE"])
def delete_customer(id):
    try:
        result = customers.delete_one({"_id": ObjectId(id)})
    except InvalidId:
        return jsonify({"success": False, "message": "Invalid customer id"}), 400

    if result.deleted_count == 0:
        return jsonify({"success": False, "message": "Customer not found"}), 404

    return jsonify({"success": True, "message": "Customer deleted successfully"})
