import bcrypt

# Replace 'YOUR_DESIRED_ADMIN_PASSWORD' with the actual password you want to hash
password = b"YOUR_DESIRED_ADMIN_PASSWORD"

# Generate a salt and hash the password
hashed_password = bcrypt.hashpw(password, bcrypt.gensalt())

# Print the hashed password (decode to utf-8 to get a string)
print(hashed_password.decode('utf-8'))