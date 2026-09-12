const Resource = require('../models/Resource');

/** GET /api/courses/:courseId/resources */
async function listResourcesForCourse(req, res, next) {
  try {
    const resources = await Resource.find({ courseId: req.params.courseId }).sort({ createdAt: 1 });
    res.json(resources);
  } catch (err) {
    next(err);
  }
}

module.exports = { listResourcesForCourse };
