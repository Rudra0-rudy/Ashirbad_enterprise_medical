from datetime import datetime, timedelta, UTC
from flask import Blueprint, jsonify
from database.mongodb import db

dashboard_bp = Blueprint("dashboard", __name__)
products = db.products
orders = db.orders
customers = db.customers

LOW_STOCK_THRESHOLD = 20
EXPIRY_WINDOW_DAYS = 60


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


@dashboard_bp.route("/api/dashboard/stats", methods=["GET"])
def get_stats():
    total_products = products.count_documents({})
    total_orders = orders.count_documents({})
    total_customers = customers.count_documents({})

    revenue_cursor = orders.aggregate([
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ])
    revenue_result = list(revenue_cursor)
    total_revenue = round(revenue_result[0]["total"], 2) if revenue_result else 0

    # today's orders (created since midnight UTC)
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders_count = orders.count_documents({"created_at": {"$gte": today_start}})

    # pending payment: unpaid orders, count + total value at risk
    pending_payment_cursor = orders.aggregate([
        {"$match": {"payment_status": "unpaid", "status": {"$ne": "cancelled"}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ])
    pending_payment_result = list(pending_payment_cursor)
    pending_payment_count = pending_payment_result[0]["count"] if pending_payment_result else 0
    pending_payment_amount = round(pending_payment_result[0]["total"], 2) if pending_payment_result else 0

    # pending orders: placed but not yet started processing
    pending_orders_count = orders.count_documents({"status": "pending"})
    pending_orders = [serialize(o) for o in orders.find(
        {"status": "pending"}
    ).sort("created_at", -1).limit(8)]

    # upcoming orders: already being worked on, not yet delivered
    upcoming_orders_count = orders.count_documents({"status": {"$in": ["processing", "shipped"]}})
    upcoming_orders = [serialize(o) for o in orders.find(
        {"status": {"$in": ["processing", "shipped"]}}
    ).sort("created_at", -1).limit(8)]

    low_stock_count = products.count_documents({"stock": {"$lte": LOW_STOCK_THRESHOLD}})

    expiry_cutoff = (datetime.now(UTC) + timedelta(days=EXPIRY_WINDOW_DAYS)).strftime("%Y-%m-%d")
    today_str = datetime.now(UTC).strftime("%Y-%m-%d")
    expiring_soon_count = products.count_documents({
        "expiry": {"$ne": None, "$gte": today_str, "$lte": expiry_cutoff}
    })
    expired_count = products.count_documents({
        "expiry": {"$ne": None, "$lt": today_str}
    })

    low_stock_products = [serialize(p) for p in products.find(
        {"stock": {"$lte": LOW_STOCK_THRESHOLD}}
    ).sort("stock", 1).limit(6)]

    return jsonify({
        "total_products": total_products,
        "total_orders": total_orders,
        "total_customers": total_customers,
        "total_revenue": total_revenue,
        "today_orders_count": today_orders_count,
        "pending_payment_count": pending_payment_count,
        "pending_payment_amount": pending_payment_amount,
        "pending_orders_count": pending_orders_count,
        "pending_orders": pending_orders,
        "upcoming_orders_count": upcoming_orders_count,
        "upcoming_orders": upcoming_orders,
        "low_stock_count": low_stock_count,
        "expiring_soon_count": expiring_soon_count,
        "expired_count": expired_count,
        "low_stock_products": low_stock_products,
    })