const bcrypt = require('bcryptjs'); // if you installed 'bcrypt' instead, change this to require('bcrypt')
const userModel = require('../models/userModel');

async function signup(req, res) {
  try {
    const { name, email, password, role } = req.body;

    // 1) basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // 2) let people sign up only as customer or vendor — never admin
    const userRole = (role === 'vendor') ? 'vendor' : 'customer';

    // 3) block duplicate emails
    const existing = await userModel.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // 4) hash the password, store ONLY the hash
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await userModel.createUser({ name, email, passwordHash, role: userRole });

    // 5) respond — never send the hash back
    return res.status(201).json({
      message: 'Account created successfully.',
      user: { userId, name, email, role: userRole }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Something went wrong creating the account.' });
  }
}

module.exports = { signup };