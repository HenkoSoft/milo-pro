"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBearerToken = getBearerToken;
exports.isAdminUser = isAdminUser;
exports.requireAuthenticatedUser = requireAuthenticatedUser;
function getBearerToken(req) {
    const rawHeader = req.headers.authorization;
    if (!rawHeader)
        return null;
    const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const parts = String(value || '').split(' ');
    return parts.length >= 2 ? parts[1] || null : null;
}
function isAdminUser(user) {
    return Boolean(user && user.role === 'admin');
}
function requireAuthenticatedUser(req) {
    return req.user || null;
}
