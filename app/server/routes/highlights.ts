// import express, { Response, Request } from 'express';
// var router = express.Router();
// import { v4 as uuidv4 } from 'uuid';
// import { sendMessage, sendData } from '../services/sockets';
// import { VideoAIData } from '../models/video-ai-data';
// import { UserProfile } from '../models/user-profile';
// import { deleteFromS3, uploadToS3 } from '../services/storage/s3';
// import { tryCatchError } from '../services/video-generation/footage-generation';
// import { getFocusedSegments } from '../services/video-generation/v11-proper-context/utils/get-focused-segments';
// import { authenticateJWT } from '../middleware/auth-middleware';
// import { safelyDelete } from '../services/fs';
// import { resizeVideo, trimVideo } from '../services/video-manipulation/ffmpeg';
// import { ExportJob } from '../models/export-job';
// import { getS3FileUrl } from '../config/aws';
// import { AuthenticatedRequest, IHighlightData, ITranscriptionJob, IVideoAIData } from '../types';
// import { generateMoreHighlights } from '../services/highlighting';
// import { HighlightData } from '../models/highlight-data';
// import { HighlightInstance } from '../models/highlight-instance';
// import { scheduleASDCrop } from '../services/sieve';
// import { formatTranscriptionWords } from '../utils/formatter';
// import { getAdjustedVisibleWords, getSentencesFromWords } from 'shared/utils/trimming';
// import { reduceCroppedOutput } from 'shared/utils/vertical';
// import { restrictRoleAccess } from '../middleware/role-access-middleware';
// import { FilterQuery, ObjectId } from 'mongoose';
// import { transcribeUrl } from '../services/ai/deepgram';
// import mime from 'mime';
// import fs from 'fs';
// import { logger } from '../services/logging';

// // DEPRECATED: This route is deprecated and will be removed in a future version

// router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
//   try {
//     const userProfile = await UserProfile.findOne({ firebaseId: req.user!.user_id });

//     const client = req.query.client;

//     const query: FilterQuery<IHighlightData> = {};
//     if (!userProfile || userProfile.role === 'editor' || userProfile.role === 'admin') {
//       if (client === 'all' || !client) {
//         const clientCondition = client === 'all' ? { client: { $exists: true } } : null;
//         query.$or = [{ userId: req.user!.user_id }];
//         if (clientCondition) {
//           query.$or.push(clientCondition);
//         }
//       } else if (!!client) {
//         query.client = client;
//       }
//     }

//     const generatedVideos = await HighlightData.find(query)
//       .sort({
//         updatedAt: -1
//       })
//       .limit(typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 1000)
//       .populate({
//         path: 'highlights',
//         options: {
//           sort: { score: -1 },
//           select: {
//             _id: 1,
//             isAcceptedForEditing: 1,
//             title: 1,
//             score: 1
//           },
//           populate: {
//             path: 'videoAIData',
//             populate: {
//               path: 'reviews',
//               options: {
//                 sort: { createdAt: -1 }
//               }
//             }
//           }
//         }
//       })
//       .select({
//         title: 1,
//         _id: 1,
//         thumbnail: 1,
//         client: 1,
//         source: {
//           thumbnail: 1,
//           url: 1
//         },
//         highlights: {
//           _id: 1,
//           videoAIData: {
//             reviews: 1
//           },
//           isAcceptedForEditing: 1,
//           title: 1
//         }
//       });
//     // const generatedVideos = await VideoAIData.find({ userId: req.user.user_id });
//     res.json(generatedVideos);
//   } catch (e) {
//     logger.error('Error fetching highlights', {
//       Error: e,
//       'User ID': req.user!.user_id
//     });
//     return res.status(500).json({ message: 'Internal server error.' });
//   }
// });

// router.put('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
//   const id = req.params.id;
//   if (!id) {
//     return res.status(400).json({ message: 'highlight id is mandatory.' });
//   }
//   try {
//     const result = await HighlightData.findById(id).select({
//       title: 1,
//       _id: 1,
//       thumbnail: 1,
//       userId: 1,
//       source: {
//         thumbnail: 1
//       },
//       highlights: {
//         _id: 1,
//         isAcceptedForEditing: 1,
//         title: 1
//       }
//     });

//     if (!result) {
//       return res.status(404).json({ message: 'highlight not found.' });
//     }

//     if (!(req.user!.user_id === result?.userId)) {
//       return res.status(401).json({ message: 'Not authorized to view this highlight.' });
//     }
//     result.title = req.body.title;
//     await result.save();
//     return res.json({ data: result });
//   } catch (e) {
//     logger.error('Error updating highlight', {
//       Error: e,
//       'User ID': req.user!.user_id
//     });
//     return res.status(400).json({ message: 'Invalid object id.' });
//   }
// });

// router.get(
//   '/:id/:highlightId',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;
//     const highlightId = req.params.highlightId;
//     if (!id || !highlightId) {
//       return res.status(400).json({ message: 'highlight id is mandatory.' });
//     }
//     try {
//       const result = await HighlightData.findById(id)
//         .populate<{ transcriptionJob: ITranscriptionJob }>('transcriptionJob')
//         .populate({
//           path: 'highlights',
//           options: {
//             sort: { score: -1 },
//             select: {
//               _id: 1,
//               isAcceptedForEditing: 1,
//               title: 1,
//               score: 1
//             }
//           }
//         });

//       if (!result) {
//         return res.status(404).json({ message: 'highlight not found.' });
//       }
//       // TODO: Only editors for whom the client is assigned can view
//       // if (!(req.user!.user_id === result?.userId)) {
//       //   return res.status(401).json({ message: 'Not authorized to view this highlight.' });
//       // }
//       const highlight = await HighlightInstance.findOne({ _id: highlightId });
//       if (!highlight) {
//         return res.status(404).json({ message: 'highlight instance not found.' });
//       }
//       const broll = await VideoAIData.findOne({ highlightInstanceId: highlight._id });
//       if (!broll) {
//         return res.status(404).json({ message: 'B-roll instance not found. Configuration error.' });
//       }
//       return res.json({ data: result, highlight, broll });
//     } catch (e) {
//       logger.error('Error fetching highlights', {
//         Error: e,
//         'User ID': req.user!.user_id
//       });
//       return res.status(400).json({ message: 'Invalid object id.' });
//     }
//   }
// );

// router.put(
//   '/:id/:highlightId',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;

//     const highlightId = req.params.highlightId;
//     if (!id || !highlightId) {
//       return res.status(400).json({ message: 'highlight id is mandatory.' });
//     }
//     const doc = await HighlightData.findOne({ _id: id });

//     if (!doc) {
//       return res.status(404).json({ message: 'HighlightData not found.' });
//     }
//     // if (!doc?.userId === req.user!.user_id) {
//     //   return res.status(401).json({ message: 'Not authorized to edit this HighlightData.' });
//     // }

//     const highlight = await HighlightInstance.findOne({ _id: highlightId });
//     if (!highlight) {
//       return res.status(404).json({ message: 'highlight instance not found.' });
//     }
//     highlight.overwrite(req.body);
//     await highlight.save();
//     return res.json(highlight);
//   }
// );

// router.put(
//   '/:id/:highlightId/title',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;

//     const highlightId = req.params.highlightId;
//     if (!id || !highlightId) {
//       return res.status(400).json({ message: 'highlight id is mandatory.' });
//     }
//     const doc = await HighlightData.findOne({ _id: id });

//     if (!doc) {
//       return res.status(404).json({ message: 'HighlightData not found.' });
//     }

//     const highlight = await HighlightInstance.findOne({ _id: highlightId });
//     if (!highlight) {
//       return res.status(404).json({ message: 'highlight instance not found.' });
//     }
//     highlight.title = req.body.title;
//     await highlight.save();
//     return res.json(highlight);
//   }
// );

// router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
//   const id = req.params.id;
//   if (!id) {
//     return res.status(400).json({ message: 'Video id is mandatory.' });
//   }
//   const result = await HighlightData.findOne({ _id: id }).populate<{
//     transcriptionJob: ITranscriptionJob;
//   }>('transcriptionJob');
//   const highlights = await HighlightInstance.find({ highlightData: id }).populate<{
//     videoAIData: IVideoAIData & { _id: ObjectId };
//   }>('videoAIData');

//   if (!result) {
//     return res.status(404).json({ message: 'Video not found.' });
//   }
//   const urlParts = result.source.url.split('/').reverse();
//   const videoName = urlParts[0];
//   deleteFromS3(videoName, err => {
//     if (err) {
//       logger.error('Error deleting source from cloud', {
//         Error: err
//       });
//     }
//     const urlParts = result.source.thumbnail.split('/').reverse();
//     const videoName = urlParts[0];
//     deleteFromS3(videoName, async err => {
//       if (err) {
//         logger.error('Error deleting thumbnail from cloud', {
//           Error: err
//         });
//       }
//       for (const highlight of highlights) {
//         for (const preview of highlight.previews ?? []) {
//           const urlParts = preview.split('/').reverse();
//           const videoName = urlParts[0];
//           deleteFromS3(videoName, err => {
//             if (err) {
//               logger.error('Error deleting thumbnail from cloud', {
//                 Error: err
//               });
//             }
//           });
//         }
//         if (highlight.videoAIData) {
//           const xpts = await ExportJob.find({
//             videoDataId: highlight.videoAIData._id
//           });

//           if (highlight.videoAIData.source.url) {
//             deleteFromS3(highlight.videoAIData.source.url, err => {
//               if (err) {
//                 logger.error('Error deleting highlight.videoAIData.source.url from cloud', {
//                   Error: err
//                 });
//               }
//             });
//           }

//           if (highlight.videoAIData.source.thumbnail) {
//             deleteFromS3(highlight.videoAIData.source.thumbnail, err => {
//               if (err) {
//                 logger.error('Error deleting highlight.videoAIData.source.thumbnail from cloud', {
//                   Error: err
//                 });
//               }
//             });
//           }

//           for (const expt of xpts) {
//             if (expt.videoUrl) {
//               deleteFromS3(expt.videoUrl, err => {
//                 if (err) {
//                   logger.error('Error deleting expt.videoUrl from cloud', {
//                     Error: err
//                   });
//                 }
//               });
//             }
//             if (expt.extraVideoUrl) {
//               deleteFromS3(expt.extraVideoUrl, err => {
//                 if (err) {
//                   logger.error('Error deleting expt.extraVideoUrl from cloud', {
//                     Error: err
//                   });
//                 }
//               });
//             }

//             await expt.deleteOne();
//           }
//         }
//         await highlight.deleteOne();
//       }
//       if (result.transcriptionJob.audioUrl) {
//         const urlParts = result.transcriptionJob.audioUrl.split('/').reverse();
//         const videoName = urlParts[0];
//         deleteFromS3(videoName, err => {
//           if (err) {
//             logger.error('Error deleting thumbnail from cloud', {
//               Error: err
//             });
//           }
//         });
//       }
//       await result.deleteOne();
//       return res.json({ success: true });
//     });
//   });
// });

// router.delete('/:id/:highlightId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
//   const id = req.params.id;
//   const highlightId = req.params.highlightId;
//   if (!id) {
//     return res.status(400).json({ message: 'HL id is mandatory.' });
//   }
//   const result = await HighlightData.findOne({ _id: id, userId: req.user!.user_id }).populate<{
//     transcriptionJob: ITranscriptionJob;
//   }>('transcriptionJob');
//   try {
//     const highlight = await HighlightInstance.findById(highlightId);

//     if (!result || !highlight) {
//       return res.status(404).json({ message: 'HL not found.' });
//     }

//     for (const preview of highlight.previews ?? []) {
//       const urlParts = preview.split('/').reverse();
//       const videoName = urlParts[0];
//       deleteFromS3(videoName, err => {
//         if (err) {
//           logger.error('Error deleting thumbnail from cloud', {
//             Error: err
//           });
//         }
//       });
//     }
//     await highlight.deleteOne();
//     res.json({ success: true });
//   } catch (e) {
//     logger.error('Error deleting highlight', {
//       Error: e,
//       'User ID': req.user!.user_id
//     });
//     return res.status(400).json({ message: 'Invalid object id.' });
//   }
// });

// router.post(
//   '/:id/generate',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;

//     if (!id) {
//       return res.status(400).json({ message: 'HighlightData id is mandatory.' });
//     }
//     try {
//       const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>(
//         'transcriptionJob'
//       );

//       if (!doc) {
//         return res.status(404).json({ message: 'HighlightData not found.' });
//       }
//       if (!doc?.userId === req.user!.user_id) {
//         return res.status(401).json({ message: 'Not authorized to edit this HighlightData.' });
//       }
//       const eventId = uuidv4();

//       res.json({ eventId });

//       generateMoreHighlights({
//         transcriptJson: doc.transcriptionJob.deepgramResults!,
//         guidance: req.body.guidance,
//         userId: req.user!.user_id,
//         highlightData: doc,
//         tjId: doc.transcriptionJob._id.toString(),
//         eventId
//       });
//     } catch (e) {
//       logger.error('Error generating highlights', {
//         Error: e,
//         'User ID': req.user!.user_id
//       });
//       return res.status(400).json({ message: 'Invalid object id.' });
//     }
//   }
// );

// router.post(
//   '/:id/speaker-map',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;

//     if (!id) {
//       return res.status(400).json({ message: 'HighlightData id is mandatory.' });
//     }
//     try {
//       const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>(
//         'transcriptionJob'
//       );

//       if (!doc) {
//         return res.status(404).json({ message: 'HighlightData not found.' });
//       }
//       // if (!doc?.userId === req.user!.user_id) {
//       //   return res.status(401).json({ message: 'Not authorized to edit this HighlightData.' });
//       // }
//       doc.speakerMap = req.body;
//       await doc.save();

//       res.json({ status: 'success' });
//     } catch (e) {
//       logger.error('Error generating speaker map', {
//         Error: e,
//         'User ID': req.user!.user_id
//       });
//       return res.status(400).json({ message: 'Invalid object id.' });
//     }
//   }
// );

// router.post(
//   '/:id/:highlightId/b-roll',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;
//     const highlightId = req.params.highlightId;
//     const includeMusic = req.body.includeMusic;
//     const userId = req.user!.user_id;

//     if (!id) {
//       return res.status(400).json({ message: 'HighlightData id is mandatory.' });
//     }
//     if (!highlightId) {
//       return res.status(400).json({ message: 'Highlight id is mandatory.' });
//     }
//     try {
//       const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>(
//         'transcriptionJob'
//       );
//       const highlight = await HighlightInstance.findOne({ _id: highlightId });

//       if (!doc) {
//         return res.status(404).json({ message: 'HighlightData not found.' });
//       }
//       // if (!doc?.userId === req.user!.user_id) {
//       //   return res.status(401).json({ message: 'Not authorized to edit this HighlightData.' });
//       // }
//       if (!highlight) {
//         return res.status(400).json({ message: 'Highlight not found.' });
//       }
//       const broll = await VideoAIData.findOne({ highlightInstanceId: highlight._id });
//       if (!broll) {
//         return res.status(404).json({ message: 'Broll object not found' });
//       }

//       const eventId = uuidv4();
//       res.json({ eventId });
//       const visibleWords = getAdjustedVisibleWords(highlight.editedWordsList!);

//       sendMessage(userId, eventId, 'Generating footage suggestions...');
//       const focusedSegments = await getFocusedSegments({
//         transcript: visibleWords,
//         isTalkingHead: true,
//         eventId,
//         brollDuration: 3.5,
//         userId,
//         useVideoEmbeddings: true
//       });

//       broll.segments = focusedSegments ?? [];

//       await broll.save();

//       sendData(userId, eventId, { isBroll: true });
//     } catch (e) {
//       logger.error('Error generating broll', {
//         Error: e,
//         'User ID': req.user!.user_id
//       });
//       return res.status(400).json({ message: 'Invalid object id.' });
//     }
//   }
// );

// router.post(
//   '/:id/:highlightId/accept-for-editing',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;
//     const highlightId = req.params.highlightId;

//     if (!id) {
//       return res.status(400).json({ message: 'HighlightData id is mandatory.' });
//     }
//     if (!highlightId) {
//       return res.status(400).json({ message: 'Highlight id is mandatory.' });
//     }
//     try {
//       const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>(
//         'transcriptionJob'
//       );

//       if (!doc) {
//         return res.status(404).json({ message: 'HighlightData not found.' });
//       }
//       // if (!doc?.userId === req.user!.user_id) {
//       //   return res.status(401).json({ message: 'Not authorized to access this HighlightData.' });
//       // }
//       const highlight = await HighlightInstance.findOne({ _id: highlightId });
//       if (!highlight) {
//         return res.status(400).json({ message: 'Highlight not found.' });
//       }
//       highlight.isAcceptedForEditing = req.body.isAcceptedForEditing === true;
//       await highlight.save();
//       res.json({ success: true });
//     } catch (e) {
//       logger.error('Error accepting highlight for editing', {
//         Error: e,
//         'User ID': req.user!.user_id
//       });
//       return res.status(400).json({ message: 'Invalid object id.' });
//     }
//   }
// );

// router.post(
//   '/:id/:highlightId/vertical',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;
//     const highlightId = req.params.highlightId;
//     const userId = req.user!.user_id;

//     if (!id) {
//       return res.status(400).json({ message: 'HighlightData id is mandatory.' });
//     }
//     if (!highlightId) {
//       return res.status(400).json({ message: 'Highlight id is mandatory.' });
//     }
//     try {
//       const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>(
//         'transcriptionJob'
//       );

//       if (!doc) {
//         return res.status(404).json({ message: 'HighlightData not found.' });
//       }
//       if (!doc?.userId === req.user!.user_id) {
//         return res.status(401).json({ message: 'Not authorized to access this HighlightData.' });
//       }
//       const highlight = await HighlightInstance.findOne({ _id: highlightId });
//       if (!highlight) {
//         return res.status(400).json({ message: 'Highlight not found.' });
//       }
//       if (!highlight.source?.url) {
//         return res.status(404).json({ message: 'No source video found for highlight' });
//       }
//       const eventId = uuidv4();
//       res.json({ eventId });
//       sendMessage(userId, eventId, 'Starting vertical recrop. This may take awhile...');

//       // TODO: Make this secure before mass launch
//       await scheduleASDCrop({
//         url: highlight.source.url,
//         callbackUrl: `/highlights/${id}/${highlightId}/recrop/done?eventId=${eventId}&userId=${userId}`,
//         returnVideo: false
//       });
//     } catch (e) {
//       logger.error('Error starting vertical recrop', {
//         Error: e,
//         'User ID': req.user!.user_id
//       });
//       return res.status(400).json({ message: 'Invalid object id.' });
//     }
//   }
// );

// router.post(
//   '/:id/:highlightId/retranscribe',
//   authenticateJWT,
//   restrictRoleAccess(['admin', 'editor']),
//   async (req: AuthenticatedRequest, res: Response) => {
//     const id = req.params.id;
//     const highlightId = req.params.highlightId;
//     const userId = req.user!.user_id;
//     const startTime = req.body.startTime as number;
//     const endTime = req.body.endTime as number;

//     if (!id) {
//       return res.status(400).json({ message: 'HighlightData id is mandatory.' });
//     }
//     if (!highlightId) {
//       return res.status(400).json({ message: 'Highlight id is mandatory.' });
//     }
//     try {
//       const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>(
//         'transcriptionJob'
//       );

//       if (!doc) {
//         return res.status(404).json({ message: 'HighlightData not found.' });
//       }
//       if (!doc?.userId === req.user!.user_id) {
//         return res.status(401).json({ message: 'Not authorized to access this HighlightData.' });
//       }
//       const highlight = await HighlightInstance.findOne({ _id: highlightId });
//       if (!highlight) {
//         return res.status(400).json({ message: 'Highlight not found.' });
//       }
//       if (!highlight.source?.url) {
//         return res.status(404).json({ message: 'No source video found for highlight' });
//       }
//       const source = highlight.source.url;

//       const [cutVideoFilename, cutVideoPath] = await trimVideo(source, startTime, endTime, progress =>
//         logger.info('Trimming progress: ' + progress)
//       );
//       await uploadToS3(
//         cutVideoPath,
//         cutVideoFilename,
//         {
//           mimeType: mime.getType(cutVideoPath) ?? '',
//           originalName: cutVideoFilename,
//           fileSize: fs.statSync(cutVideoPath).size,
//           userId: userId
//         },
//         new Date(Date.now() + 3600 * 1000) /** 1 hr from now */
//       );
//       const videoUrl = getS3FileUrl(cutVideoFilename);
//       const results = await transcribeUrl(videoUrl);
//       const newWords = results.map(word => ({
//         ...word,
//         start: word.start + startTime,
//         end: word.end + startTime
//       }));

//       // await highlight.save();
//       res.json(newWords);
//     } catch (e) {
//       logger.error('Error retranscribing highlight', {
//         Error: e,
//         'User ID': req.user!.user_id
//       });
//       return res.status(400).json({ message: 'Invalid object id.' });
//     }
//   }
// );
// router.post('/:id/:highlightId/vertical/done', async (req: Request, res: Response) => {
//   const id = req.params.id;
//   const highlightId = req.params.highlightId;
//   const eventId = req.query.eventId?.toString() ?? '';
//   const userId = req.query.userId?.toString() ?? '';

//   res.status(200).json({ success: true });
//   sendMessage(userId, eventId, `Recrop fininished...`);
//   if (!id) {
//     return sendMessage(userId, eventId, `HighlightData id is mandatory.`);
//   }
//   if (!highlightId) {
//     return sendMessage(userId, eventId, 'Highlight id is mandatory.');
//   }
//   try {
//     const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>('transcriptionJob');

//     if (!doc) {
//       return sendMessage(userId, eventId, 'HighlightData not found.');
//     }
//     const highlight = await HighlightInstance.findOne({ _id: highlightId });
//     if (!highlight) {
//       return sendMessage(userId, eventId, 'Highlight not found.');
//     }
//     if (req.body.body?.status !== 'finished') {
//       return sendMessage(userId, eventId, `Job status: ${req.body.body?.status}.`);
//     }

//     const data = req.body.body?.output?.find((o: { Key: string; Value: any }) => {
//       return o.Key === 'data';
//     });
//     if (!data.Value || data.Value.length === 0) {
//       return sendMessage(userId, eventId, 'Invalid output.');
//     }
//     const url = data.Value.find((v: { Key: string; Value: string | null }) => v.Key === 'url')?.Value;

//     sendMessage(userId, eventId, `Processing file...`);
//     const filename = `${new Date().getTime()}.mp4`;
//     const videoLocation = `/tmp/data/${filename}`;

//     await tryCatchError(
//       () => resizeVideo(url, videoLocation, { width: 1080, height: 1920 }),
//       userId,
//       eventId,
//       'Error downloading file.'
//     );

//     sendMessage(userId, eventId, `Uploading to cloud...`);
//     await tryCatchError(
//       () =>
//         uploadToS3(videoLocation, filename, {
//           mimeType: mime.getType(videoLocation) ?? '',
//           originalName: filename,
//           fileSize: fs.statSync(videoLocation).size,
//           userId: userId
//         }),
//       userId,
//       eventId,
//       'Error uploading video to cloud.'
//     );

//     sendMessage(userId, eventId, `Successfully uploaded to cloud.`);
//     const videoUrl = getS3FileUrl(filename);
//     const highlight1 = await HighlightInstance.findOne({ _id: highlightId });
//     if (!highlight1?.verticalPreviews) {
//       highlight1!.verticalPreviews = [];
//     }
//     highlight1!.verticalPreviews!.push(videoUrl);
//     await highlight1!.save();

//     await safelyDelete(videoLocation);
//     sendMessage(userId, eventId, `Received url, your video preview will be reloaded.`);
//     sendData(userId, eventId, { videoUrl });
//   } catch (e) {
//     logger.error('Error finishing vertical recrop', {
//       Error: e,
//       'User ID': userId
//     });
//     return res.status(400).json({ message: 'Invalid object id.' });
//   }
// });

// router.post('/:id/:highlightId/recrop/done', async (req: Request, res: Response) => {
//   const id = req.params.id;
//   const highlightId = req.params.highlightId;
//   const eventId = req.query.eventId?.toString() ?? '';
//   const userId = req.query.userId?.toString() ?? '';
//   sendMessage(userId, eventId, 'Recrop information received. Saving...');

//   res.status(200).json({ success: true });
//   if (!id) {
//     return sendMessage(userId, eventId, `HighlightData id is mandatory.`);
//   }
//   if (!highlightId) {
//     return sendMessage(userId, eventId, 'Highlight id is mandatory.');
//   }
//   try {
//     const doc = await HighlightData.findById(id).populate<{ transcriptionJob: ITranscriptionJob }>('transcriptionJob');

//     if (!doc) {
//       return sendMessage(userId, eventId, 'HighlightData not found.');
//     }
//     const highlight = await HighlightInstance.findOne({ _id: highlightId });
//     if (!highlight) {
//       return sendMessage(userId, eventId, 'Highlight not found.');
//     }
//     if (req.body.body?.status !== 'finished') {
//       return sendMessage(userId, eventId, `Job status: ${req.body.body?.status}.`);
//     }

//     const videoAiData = await VideoAIData.findOne({
//       highlightInstanceId: highlight._id
//     });

//     if (!videoAiData) {
//       return sendMessage(userId, eventId, 'Video AI Data not found.');
//     }
//     if (videoAiData.croppedInfo && videoAiData.croppedInfo.length > 0) {
//       return sendMessage(userId, eventId, 'Video already has vertical crop information.');
//     }
//     videoAiData.croppedInfo = reduceCroppedOutput(req.body);
//     await videoAiData.save();

//     sendData(userId, eventId, { isRecrop: true });
//   } catch (e) {
//     logger.error('Error finishing vertical recrop', {
//       Error: e,
//       'User ID': userId
//     });
//     return res.status(400).json({ message: 'Invalid object id.' });
//   }
// });

// export default router;
