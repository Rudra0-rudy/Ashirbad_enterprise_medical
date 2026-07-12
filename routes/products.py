from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, UTC
from flask import Blueprint, request, jsonify
from database.mongodb import db

product_bp = Blueprint("products", __name__)
products = db.products

LOW_STOCK_THRESHOLD = 20


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


def to_number(value, cast=float, default=0):
    try:
        return cast(value)
    except (TypeError, ValueError):
        return default


# -------------------------------
# ADD PRODUCT
# -------------------------------
@product_bp.route("/api/products", methods=["POST"])
def add_product():
    data = request.json or {}

    if not data.get("name"):
        return jsonify({"success": False, "message": "Product name is required"}), 400

    product = {
        "name": data.get("name", "").strip(),
        "brand": data.get("brand", "").strip(),
        "category": data.get("category", "").strip(),
        "price": to_number(data.get("price")),
        "mrp": to_number(data.get("mrp")),
        "stock": to_number(data.get("stock"), int, 0),
        "expiry": data.get("expiry") or None,
        "batch": data.get("batch", "").strip(),
        "description": data.get("description", "").strip(),
        "image": data.get("image", "").strip(),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }

    result = products.insert_one(product)

    return jsonify({
        "success": True,
        "message": "Product added successfully",
        "id": str(result.inserted_id)
    }), 201


# -------------------------------
# GET ALL PRODUCTS
# -------------------------------
@product_bp.route("/api/products", methods=["GET"])
def get_products():
    all_products = [serialize(p) for p in products.find().sort("created_at", -1)]
    return jsonify(all_products)


# -------------------------------
# SEARCH PRODUCTS
# -------------------------------
@product_bp.route("/api/products/search", methods=["GET"])
def search_products():
    query = request.args.get("q")

    if not query:
        return jsonify({"success": False, "message": "Search query is required"}), 400

    search_filter = {
        "$or": [
            {"name": {"$regex": query, "$options": "i"}},
            {"brand": {"$regex": query, "$options": "i"}},
            {"category": {"$regex": query, "$options": "i"}},
            {"batch": {"$regex": query, "$options": "i"}},
        ]
    }

    results = [serialize(p) for p in products.find(search_filter).sort("created_at", -1)]
    return jsonify(results), 200


# -------------------------------
# GET SINGLE PRODUCT
# -------------------------------
@product_bp.route("/api/products/<id>", methods=["GET"])
def get_product(id):
    try:
        product = products.find_one({"_id": ObjectId(id)})
    except InvalidId:
        return jsonify({"message": "Invalid product id"}), 400

    if not product:
        return jsonify({"message": "Product not found"}), 404

    return jsonify(serialize(product))


# -------------------------------
# UPDATE PRODUCT
# -------------------------------
@product_bp.route("/api/products/<id>", methods=["PUT"])
def update_product(id):
    data = request.json or {}

    update_fields = {
        "name": data.get("name", "").strip(),
        "brand": data.get("brand", "").strip(),
        "category": data.get("category", "").strip(),
        "price": to_number(data.get("price")),
        "mrp": to_number(data.get("mrp")),
        "stock": to_number(data.get("stock"), int, 0),
        "expiry": data.get("expiry") or None,
        "batch": data.get("batch", "").strip(),
        "description": data.get("description", "").strip(),
        "image": data.get("image", "").strip(),
        "updated_at": datetime.now(UTC),
    }

    try:
        result = products.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    except InvalidId:
        return jsonify({"success": False, "message": "Invalid product id"}), 400

    if result.matched_count == 0:
        return jsonify({"success": False, "message": "Product not found"}), 404

    return jsonify({"success": True, "message": "Product updated successfully"})


# -------------------------------
# DELETE PRODUCT
# -------------------------------
@product_bp.route("/api/products/<id>", methods=["DELETE"])
def delete_product(id):
    try:
        result = products.delete_one({"_id": ObjectId(id)})
    except InvalidId:
        return jsonify({"success": False, "message": "Invalid product id"}), 400

    if result.deleted_count == 0:
        return jsonify({"success": False, "message": "Product not found"}), 404

    return jsonify({"success": True, "message": "Product deleted successfully"})
