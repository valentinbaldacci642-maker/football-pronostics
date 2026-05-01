const express = require('express');
const router = express.Router();

router.use('/fixtures', require('./fixtures'));
router.use('/predictions', require('./predictions'));
router.use('/odds', require('./odds'));
router.use('/teams', require('./teams'));
router.use('/players', require('./players'));
router.use('/leagues', require('./leagues'));
router.use('/analysis', require('./analysis'));
router.use('/scorers', require('./scorers'));
router.use('/pronostics', require('./pronostics'));
router.use('/cache', require('./cacheAdmin'));
router.use('/news', require('./news'));

module.exports = router;
