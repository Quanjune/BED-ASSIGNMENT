const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

async function signup(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const userRole = (role === 'vendor') ? 'vendor' : 'customer';

    const existing = await userModel.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await userModel.createUser({ name, email, passwordHash, role: userRole });

    return res.status(201).json({
      message: 'Account created successfully.',
      user: { userId, name, email, role: userRole }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Something went wrong creating the account.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await userModel.findUserByEmail(email);
    // Same message whether the email is missing OR the password is wrong —
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // What future requests know about this user:
    const payload = { userId: user.userId, role: user.role };
    const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      message: 'Login successful.',
      accessToken: token,
      user: { userId: user.userId, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Something went wrong during login.' });
  }
}

// Returns the profile of whoever is logged in (identified by their token)
async function getProfile(req, res) {
  try {
    const user = await userModel.findUserById(req.user.userId); // req.user came from verifyToken
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });
    // block taking an email that already belongs to someone else
    const existing = await userModel.findUserByEmail(email);
    if (existing && existing.userId !== req.user.userId) {
      return res.status(409).json({ message: 'That email is already in use.' });
    }
    const rowsChanged = await userModel.updateUser(req.user.userId, { name, email });
    if (rowsChanged === 0) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ message: 'Profile updated.', user: { userId: req.user.userId, name, email } });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Something went wrong updating the profile.' });
  }
}

async function deleteAccount(req, res) {
  try {
    const rowsDeleted = await userModel.deleteUser(req.user.userId);
    if (rowsDeleted === 0) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ message: 'Account deleted.' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ message: 'Something went wrong deleting the account.' });
  }
}

async function getAllUsers(req, res) {
  try {
    const users = await userModel.getAllUsers();
    return res.status(200).json({ count: users.length, users });
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

module.exports = { signup, login, getProfile, updateProfile, deleteAccount, getAllUsers };