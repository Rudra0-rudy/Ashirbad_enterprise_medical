from database.mongodb import client

try:
    # Test MongoDB connection
    client.admin.command("ping")
    print("MongoDB Connected Successfully!")
except Exception as e:
    print("MongoDB Connection Failed!")
    print(e)