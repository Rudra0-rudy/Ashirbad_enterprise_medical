import os
from flask import Flask, render_template, abort, request, jsonify, Response
from flask_cors import CORS
from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import PyMongoError

from routes.products import product_bp
from routes.orders import order_bp
from routes.customers import customer_bp
from routes.dashboard import dashboard_bp
from database.mongodb import db
from utils.invoice_helpers import amount_in_words

app = Flask(__name__)
CORS(app)

app.register_blueprint(product_bp)
app.register_blueprint(order_bp)
app.register_blueprint(customer_bp)
app.register_blueprint(dashboard_bp)

# -------------------------------------------------------------------
# ADMIN AUTH
# Protects the admin panel (dashboard/products/orders/customers pages
# and their underlying write/list APIs) with a browser login prompt.
# Left deliberately open: the storefront pages, product *browsing*
# (GET), and order *creation* (POST) — customers need those to shop.
# -------------------------------------------------------------------
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")

PUBLIC_PAGE_PATHS = {"/", "/catalog"}


def _is_public_request(path, method):
    if path.startswith("/static/"):
        return True
    if path in PUBLIC_PAGE_PATHS:
        return True
    if method == "GET" and path.startswith("/api/products"):
        return True
    if method == "POST" and path == "/api/orders":
        return True
    return False


@app.before_request
def require_admin_auth():
    if _is_public_request(request.path, request.method):
        return None

    auth = request.authorization
    if not auth or auth.username != ADMIN_USERNAME or auth.password != ADMIN_PASSWORD:
        return Response(
            "Admin login required.",
            401,
            {"WWW-Authenticate": 'Basic realm="Ashirbad Admin"'},
        )
    return None


@app.errorhandler(PyMongoError)
def handle_mongo_error(exc):
    """Catches any MongoDB connection/query failure that happens mid-request
    (e.g. a brief WiFi/DNS drop after the app already started successfully).
    Without this, such a failure would show a raw pymongo traceback to
    whoever is visiting the page — including customers on /shop."""
    app.logger.error(f"MongoDB error during request to {request.path}: {exc}")

    if request.path.startswith("/api/"):
        return jsonify({
            "success": False,
            "message": "Database temporarily unreachable. Please try again in a moment."
        }), 503

    return (
        "<div style=\"font-family:sans-serif; max-width:560px; margin:80px auto; "
        "text-align:center; color:#334155;\">"
        "<h2 style=\"margin-bottom:8px;\">Temporarily unavailable</h2>"
        "<p>We couldn't reach the database just now — this is usually a brief "
        "network hiccup. Please refresh in a few seconds.</p>"
        "<p><a href=\"javascript:location.reload()\">Refresh this page</a></p>"
        "</div>",
        503,
    )


@app.route("/")
def shop_page():
    total_skus = db.products.count_documents({})
    return render_template("shop.html", total_skus=total_skus)


@app.route("/catalog")
def catalog_page():
    total_skus = db.products.count_documents({})
    return render_template("catalog.html", total_skus=total_skus)


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", active="dashboard")


@app.route("/products")
def products_page():
    return render_template("products.html", active="products")


@app.route("/orders")
def orders_page():
    return render_template("orders.html", active="orders")


@app.route("/customers")
def customers_page():
    return render_template("customers.html", active="customers")


@app.route("/orders/<id>/invoice")
def invoice_page(id):
    try:
        order = db.orders.find_one({"_id": ObjectId(id)})
    except InvalidId:
        abort(404)

    if not order:
        abort(404)

    return render_template(
        "invoice.html",
        order=order,
        amount_words=amount_in_words(order.get("total", 0)),
    )


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        debug=False
    )