require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key'; // Use .env in production

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/my_kanban_db')
    .then(() => console.log("Connected to MongoDB securely"))
    .catch(err => console.error("MongoDB connection error:", err));

// --- Schemas & Models ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

const BoardSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const TaskSchema = new mongoose.Schema({
    text: { type: String, required: true },
    status: { type: String, enum: ['todo', 'inprogress', 'done'], default: 'todo' },
    deadline: { type: Date, default: null },
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Board = mongoose.model('Board', BoardSchema);
const Task = mongoose.model('Task', TaskSchema);

// --- Auth Middleware ---
// Explanaton: Verifies the JWT token sent from the frontend to protect routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ message: "Access Denied. No token provided." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid or expired token." });
        req.user = user;
        next();
    });
};

// ==========================================
// 🔐 AUTHENTICATION ROUTES (PHASE 2)
// ==========================================

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Fields required" });
        
        // Hash password before saving (Security Fix)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        
        // Create a default board for the new user
        const defaultBoard = new Board({ name: "My First Board", userId: newUser._id });
        await defaultBoard.save();

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: "Username taken." });
        res.status(500).json({ message: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        // Compare hashed password (Security Fix)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
        
        // Generate JWT Token
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ message: 'Login successful', token, username: user.username });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Password Reset Flow
app.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (!user) return res.status(404).json({ message: "User not found" });

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // In production, send this via Email. For now, returning in response.
        res.json({ message: "Token generated", resetToken: token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({ 
            resetPasswordToken: req.params.token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ message: "Token invalid or expired" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==========================================
// 🚀 CORE APP ROUTES (PHASE 1 & 3 PREP)
// ==========================================

// Get all boards for logged-in user
app.get('/boards', authenticateToken, async (req, res) => {
    const boards = await Board.find({ userId: req.user.id });
    res.json(boards);
});

// Create a new board
app.post('/boards', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Board name is required" });
        
        const newBoard = new Board({ name, userId: req.user.id });
        await newBoard.save();
        res.status(201).json(newBoard);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rename a board
app.put('/boards/:id', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Board name is required" });
        
        const updatedBoard = await Board.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { name },
            { new: true }
        );
        
        if (!updatedBoard) return res.status(404).json({ message: "Board not found" });
        res.json(updatedBoard);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete a board (and its tasks)
app.delete('/boards/:id', authenticateToken, async (req, res) => {
    try {
        const boardId = req.params.id;
        
        // Safety Check: Don't let the user delete their ONLY board
        const boardCount = await Board.countDocuments({ userId: req.user.id });
        if (boardCount <= 1) {
            return res.status(400).json({ message: "You cannot delete your only board. Create another one first." });
        }

        const deletedBoard = await Board.findOneAndDelete({ _id: boardId, userId: req.user.id });
        if (!deletedBoard) return res.status(404).json({ message: "Board not found" });

        // Cascading Delete: Destroy all tasks associated with this board
        await Task.deleteMany({ boardId: boardId, userId: req.user.id });

        res.json({ message: "Board and associated tasks permanently deleted." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get tasks for a specific board
app.get('/boards/:boardId/tasks', authenticateToken, async (req, res) => {
    const tasks = await Task.find({ boardId: req.params.boardId, userId: req.user.id });
    res.json(tasks);
});

// Create Task
app.post('/tasks', authenticateToken, async (req, res) => {
    const { text, boardId, deadline } = req.body;
    const newTask = new Task({ text, boardId, userId: req.user.id, deadline });
    await newTask.save();
    res.status(201).json(newTask);
});

// Update Task (Status/Text/Deadline)
app.put('/tasks/:id', authenticateToken, async (req, res) => {
    const updatedTask = await Task.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id }, 
        req.body, 
        { new: true }
    );
    res.json(updatedTask);
});

// Delete Task
app.delete('/tasks/:id', authenticateToken, async (req, res) => {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: "Task deleted" });
});

// Analytics Dashboard Endpoint
app.get('/boards/:boardId/analytics', authenticateToken, async (req, res) => {
    const tasks = await Task.find({ boardId: req.params.boardId, userId: req.user.id });
    const analytics = {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        inprogress: tasks.filter(t => t.status === 'inprogress').length,
        done: tasks.filter(t => t.status === 'done').length,
        overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done').length
    };
    res.json(analytics);
});

app.listen(PORT, () => {
    console.log(`Enterprise Server running on http://localhost:${PORT}`);
});