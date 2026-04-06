"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLoginRequest = normalizeLoginRequest;
exports.normalizeCreateUserRequest = normalizeCreateUserRequest;
exports.sanitizeAuthUser = sanitizeAuthUser;
exports.buildLoginResponse = buildLoginResponse;
exports.buildMeResponse = buildMeResponse;
exports.sanitizeUserListItem = sanitizeUserListItem;
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function normalizeLoginRequest(body) {
    const data = isRecord(body) ? body : {};
    return {
        username: String(data.username || '').trim(),
        password: String(data.password || '')
    };
}
function normalizeCreateUserRequest(body) {
    const data = isRecord(body) ? body : {};
    return {
        username: String(data.username || '').trim(),
        password: String(data.password || ''),
        role: String(data.role || 'technician').trim(),
        name: String(data.name || '').trim()
    };
}
function sanitizeAuthUser(user) {
    return {
        id: Number(user.id || 0),
        username: String(user.username || ''),
        role: String(user.role || ''),
        name: String(user.name || '')
    };
}
function buildLoginResponse(token, user) {
    return {
        token,
        user: sanitizeAuthUser(user)
    };
}
function buildMeResponse(user) {
    return sanitizeAuthUser(user);
}
function sanitizeUserListItem(user) {
    return {
        ...sanitizeAuthUser(user),
        created_at: typeof user.created_at === 'string' ? user.created_at : undefined
    };
}
