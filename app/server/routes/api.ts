import express from 'express';
var router = express.Router();

// All routes are eagerly loaded (no Lambda cold start concerns)
router.use('/auth', require('./user-auth').default || require('./user-auth'));
router.use('/', require('./profile').default || require('./profile'));
router.use('/notifications', require('./notifications').default || require('./notifications'));
router.use('/captions', require('./captions').default || require('./captions'));
router.use('/videos', require('./videos').default || require('./videos'));
router.use('/library', require('./library').default || require('./library'));
router.use('/transcription-jobs', require('./transcription-jobs').default || require('./transcription-jobs'));
router.use('/events', require('./events').default || require('./events'));
router.use('/exports', require('./exports').default || require('./exports'));
router.use('/preuser-prompts', require('./preuser-prompts').default || require('./preuser-prompts'));
router.use('/survey', require('./survey').default || require('./survey'));
router.use('/automation-config', require('./automation-config').default || require('./automation-config'));
router.use('/upload', require('./upload').default || require('./upload'));
router.use('/brand-assets', require('./brand-assets').default || require('./brand-assets'));
router.use('/search', require('./search').default || require('./search'));
router.use('/chat', require('./chat').default || require('./chat'));

export default router;
