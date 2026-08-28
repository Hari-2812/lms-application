/**
 * Compatibility shim.
 *
 * The student record now lives in AuthContext (which adds sign in / sign up
 * / sign out on top of it). This module keeps the original import path
 * working so nothing that referenced it has to change.
 */
export { AuthProvider as StudentProvider, useStudent } from './AuthContext.jsx';
