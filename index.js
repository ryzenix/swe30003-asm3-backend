require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const pool = require('./config/db');
const pgSession = require('connect-pg-simple')(session);

const app = express();
const authRoutes = require('./routes/auth');
const superUserAuthRoutes = require('./routes/auth/superuser');
const staffManagementRoutes = require('./routes/management/staff');
const userAuthRoutes = require('./routes/auth/user'); // Add this line

const corsOptions = {
  origin: /^http:\/\/localhost:\d+$/, // OR use regex: /^http:\/\/localhost:\d+$/
  credentials: true
};

app.use(cors(corsOptions));       // ✅ Enable CORS

app.use(express.json());

// If pool doesn't work, replace with manual DB options

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session' // default
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use('/auth', authRoutes);
app.use('/auth/superuser', superUserAuthRoutes);
app.use('/auth/user', userAuthRoutes); // Add this line

app.use('/management', staffManagementRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});