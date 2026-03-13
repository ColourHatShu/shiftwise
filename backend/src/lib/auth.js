const { verifyToken } = require('@clerk/backend');
const prisma = require('./prisma');

// ─── Auth + Agency middleware ─────────────────────────────────────────────────
// Manually extracts and verifies the Clerk JWT from the Authorization header,
// then looks up the user's associated agency in the DB.
const requireAgency = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const secretKey = process.env.CLERK_SECRET_KEY;

        if (!secretKey) {
            console.error('❌ CLERK_SECRET_KEY is not set!');
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        let payload;
        try {
            payload = await verifyToken(token, {
                secretKey,
                authorizedParties: [process.env.AUTHORIZED_PARTY || 'http://localhost:3000'],
                clockSkewInMs: 300000  // 5 min tolerance for clock skew
            });
        } catch (err) {
            console.error('❌ Token verification failed:', err.message);
            return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        }

        const clerkUserId = payload.sub;

        // Look up the user + their agency
        const user = await prisma.user.findUnique({
            where: { clerkId: clerkUserId },
            include: { agency: true }
        });

        if (!user || !user.agencyId) {
            return res.status(403).json({ error: 'User is not associated with an agency' });
        }

        req.agencyId = user.agencyId;
        req.user = user;
        next();
    } catch (error) {
        console.error('Error in requireAgency middleware:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { requireAgency };
