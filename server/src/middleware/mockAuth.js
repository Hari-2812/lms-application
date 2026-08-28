/**
 * Mock authentication for the client demo.
 * A real build would verify a JWT here and load the enrolled student.
 * Every request gets the same demo student attached.
 */
const DEMO_STUDENT = {
  id: 'demo-student-1',
  name: 'Vasanth Kumar',
  email: 'student@demo.com',
};

function mockAuth(req, _res, next) {
  req.student = DEMO_STUDENT;
  next();
}

module.exports = { mockAuth, DEMO_STUDENT };
