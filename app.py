import time
from flask import Flask, jsonify, request
from flask_cors import CORS

# Initialize the Flask app
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS) to allow your frontend to connect
CORS(app)

# Use a simple Python dictionary as an in-memory database for this example
db = {
    "tenants": [],
    "properties": [],
    "payments": [],
}

# --- API Endpoints ---

@app.route('/api/data', methods=['GET'])
def get_all_data():
    """Returns all data in the database."""
    return jsonify(db)

@app.route('/api/tenants', methods=['POST'])
def add_tenant():
    """Adds a new tenant to the database."""
    # Get the JSON data sent from the frontend
    tenant_data = request.get_json()
    
    # Create a new tenant object with a unique ID
    new_tenant = {
        "id": int(time.time() * 1000),  # Simple unique ID using timestamp
        "name": tenant_data.get('name'),
        "contact": tenant_data.get('contact'),
        "unitId": tenant_data.get('unitId'),
    }
    
    db["tenants"].append(new_tenant)
    print(f"Added Tenant: {new_tenant}")
    
    # Return the newly created tenant with a 201 "Created" status code
    return jsonify(new_tenant), 201

@app.route('/api/tenants/<int:tenant_id>', methods=['PUT'])
def update_tenant(tenant_id):
    """Updates an existing tenant."""
    tenant_data = request.get_json()
    tenant_found = False
    for i, tenant in enumerate(db["tenants"]):
        if tenant["id"] == tenant_id:
            # Update tenant details
            db["tenants"][i]["name"] = tenant_data.get("name", tenant["name"])
            db["tenants"][i]["contact"] = tenant_data.get("contact", tenant["contact"])
            db["tenants"][i]["unitId"] = tenant_data.get("unitId", tenant["unitId"])
            tenant_found = True
            print(f"Updated Tenant: {db['tenants'][i]}")
            return jsonify(db["tenants"][i]), 200
    
    if not tenant_found:
        return jsonify({"error": "Tenant not found"}), 404


# You would add more endpoints for editing, deleting, etc.
# For example, a DELETE endpoint:
@app.route('/api/tenants/<int:tenant_id>', methods=['DELETE'])
def delete_tenant(tenant_id):
    """Deletes a tenant by their ID."""
    global db
    # Find the tenant and remove them if they exist
    initial_tenant_count = len(db["tenants"])
    db["tenants"] = [t for t in db["tenants"] if t["id"] != tenant_id]
    
    if len(db["tenants"]) < initial_tenant_count:
        # Also remove their payment records
        db["payments"] = [p for p in db["payments"] if p["tenantId"] != tenant_id]
        print(f"Deleted tenant with ID: {tenant_id}")
        return jsonify({"message": "Tenant deleted successfully"}), 200
    else:
        return jsonify({"error": "Tenant not found"}), 404

@app.route('/api/properties', methods=['POST'])
def add_property():
    """Adds a new property to the database."""
    property_data = request.get_json()
    new_property = {
        "id": int(time.time() * 1000),
        "name": property_data.get('name'),
    }
    db["properties"].append(new_property)
    print(f"Added Property: {new_property}")
    return jsonify(new_property), 201

@app.route('/api/properties/<int:property_id>', methods=['DELETE'])
def delete_property(property_id):
    """Deletes a property by its ID."""
    global db
    
    # Check if any tenant is assigned to this property
    is_occupied = any(t["unitId"] == property_id for t in db["tenants"])
    if is_occupied:
        return jsonify({"error": "Cannot delete property. It is currently occupied."}), 400

    initial_prop_count = len(db["properties"])
    db["properties"] = [p for p in db["properties"] if p["id"] != property_id]
    
    if len(db["properties"]) < initial_prop_count:
        print(f"Deleted property with ID: {property_id}")
        return jsonify({"message": "Property deleted successfully"}), 200
    else:
        return jsonify({"error": "Property not found"}), 404


# Add this new endpoint to your app.py

def _create_invoice(payment):
    """A helper function to create an invoice. Underscore indicates internal use."""
    # Ensure you don't create duplicate invoices for the same payment
    payment_id_str = f"{payment['tenantId']}-{payment['year']}-{payment['month']}"
    for inv in db.get("invoices", []):
        if inv["paymentId"] == payment_id_str:
            return # Invoice already exists

    new_invoice = {
        "id": int(time.time() * 1000) + 1, # Make ID slightly different
        "paymentId": payment_id_str,
        "tenantId": payment["tenantId"],
        "issueDate": time.strftime('%Y-%m-%d'),
        "amount": 1200.00,  # Or fetch from property details
        "status": "Paid"
    }
    # Initialize invoices list if it doesn't exist
    if "invoices" not in db:
        db["invoices"] = []
    
    db["invoices"].append(new_invoice)
    print(f"Created Invoice: {new_invoice}")


@app.route('/api/payments/toggle', methods=['POST'])
def toggle_payment_status():
    """Toggles a payment status and creates an invoice if paid."""
    data = request.get_json()
    tenant_id = int(data.get('tenantId'))
    month = int(data.get('month'))
    year = int(data.get('year'))

    payment_found = False
    for p in db["payments"]:
        if p["tenantId"] == tenant_id and p["month"] == month and p["year"] == year:
            # Payment exists, toggle its status
            p["status"] = "unpaid" if p["status"] == "paid" else "paid"
            if p["status"] == "paid":
                _create_invoice(p) # Create invoice if now paid
            payment_found = True
            break
    
    if not payment_found:
        # Payment doesn't exist, create it as 'paid'
        new_payment = {
            "tenantId": tenant_id,
            "month": month,
            "year": year,
            "status": "paid"
        }
        db["payments"].append(new_payment)
        _create_invoice(new_payment) # Create an invoice for the new payment
    
    return jsonify({"message": "Payment status updated successfully"}), 200
# This allows you to run the app by executing "python app.py"
if __name__ == '__main__':
    # debug=True automatically reloads the server when you make changes
    app.run(debug=True, port=5000)
