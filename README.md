# MedWholesale Admin Panel

A Flask + MongoDB Atlas admin panel for a medical wholesaler ecommerce site, with
Dashboard, Products, Orders, and Customers sections.

## Structure

```
admin_panel/
├── app.py                  # Flask app entry point, registers blueprints & page routes
├── database/
│   └── mongodb.py          # MongoDB Atlas connection (reads MONGO_URI from .env)
├── routes/
│   ├── products.py         # /api/products CRUD + search
│   ├── orders.py           # /api/orders CRUD + status updates
│   ├── customers.py        # /api/customers CRUD (with computed order totals)
│   └── dashboard.py        # /api/dashboard/stats aggregation
├── templates/
│   ├── base.html           # Shared sidebar/topbar layout
│   ├── dashboard.html
│   ├── products.html
│   ├── orders.html
│   └── customers.html
├── static/
│   ├── css/style.css       # Shared design system
│   └── js/
│       ├── common.js       # Shared fetch/toast/format helpers
│       ├── dashboard.js
│       ├── products.js
│       ├── orders.js
│       └── customers.js
├── requirements.txt
└── .env.example
```

## Setup

1. Create a virtual environment and install dependencies:

   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and paste in your MongoDB Atlas connection string
   (Atlas dashboard → Connect → Drivers → copy the URI, then swap in your DB user's
   username/password). Make sure your current IP is allow-listed in Atlas Network Access.

   ```bash
   cp .env.example .env
   ```

3. Run the app:

   ```bash
   python app.py
   ```

4. Open `http://127.0.0.1:5000` — that's the Dashboard. Products, Orders, and
   Customers are in the sidebar.

## API overview

| Resource  | Endpoint                          | Methods                  |
|-----------|------------------------------------|---------------------------|
| Products  | `/api/products`                    | GET, POST                |
|           | `/api/products/search?q=`          | GET                       |
|           | `/api/products/<id>`               | GET, PUT, DELETE          |
| Orders    | `/api/orders`                      | GET (`?status=&q=`), POST |
|           | `/api/orders/<id>`                 | GET, PUT, DELETE          |
|           | `/api/orders/<id>/status`          | PATCH                     |
| Customers | `/api/customers`                   | GET (`?q=`), POST         |
|           | `/api/customers/<id>`              | GET, PUT, DELETE          |
| Dashboard | `/api/dashboard/stats`             | GET                       |

## Notes

- Orders store their own `items` array (name, qty, price) rather than referencing
  product IDs directly, so an order remains an accurate record even if a
  product's price later changes.
- "Low stock" is anything at or below 20 units; "expiring soon" is anything
  expiring within 60 days — both thresholds live at the top of
  `routes/products.py` / `routes/dashboard.py` if you want to tune them.
- Customer order totals (`total_orders`, `total_spent`) are computed on read
  by matching `customer_name` against the orders collection — fine at this
  scale; swap for a proper `customer_id` foreign key + aggregation pipeline
  if the catalog grows large.
- This is a single-admin internal tool with no login/auth layer. Add
  Flask-Login or a similar auth guard before exposing it beyond localhost.
