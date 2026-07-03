import mongoose from 'mongoose';
import { IVideoAIData } from '../types';
import './define-getters';
// metadata: {
//   streams: [
//     {
//       index: Number,
//       codec_name: String,
//       codec_long_name: String,
//       profile: String,
//       codec_type: String,
//       codec_tag_string: String,
//       codec_tag: String,
//       width: Number,
//       height: Number,
//       coded_width: Number,
//       coded_height: Number,
//       closed_captions: Number,
//       film_grain: Number,
//       has_b_frames: Number,
//       sample_aspect_ratio: String,
//       display_aspect_ratio: String,
//       pix_fmt: String,
//       level: Number,
//       color_range: String,
//       color_space: String,
//       color_transfer: String,
//       color_primaries: String,
//       chroma_location: String,
//       field_order: String,
//       refs: Number,
//       is_avc: String,
//       nal_length_size: Number,
//       id: String,
//       r_frame_rate: String,
//       avg_frame_rate: String,
//       time_base: String,
//       start_pts: Number,
//       start_time: Number,
//       duration_ts: Number,
//       duration: Number,
//       bit_rate: Number,
//       max_bit_rate: String,
//       bits_per_raw_sample: Number,
//       nb_frames: Number,
//       nb_read_frames: String,
//       nb_read_packets: String,
//       extradata_size: Number,
//       tags: [{}],
//       disposition: [{}]
//     }
//   ],
//   format: {
//     filename: String,
//     nb_streams: Number,
//     nb_programs: Number,
//     format_name: String,
//     format_long_name: String,
//     start_time: Number,
//     duration: Number,
//     size: Number,
//     bit_rate: Number,
//     probe_score: Number,
//     tags: {
//       major_brand: String,
//       minor_version: String,
//       compatible_brands: String,
//       comment: String,
//       aigc_info: String,
//       encoder: String
//     }
//   }
// },
const videoAiDataSchema = new mongoose.Schema<IVideoAIData>(
  {
    title: String,
    description: String,
    segments: [
      {
        alternatives: [
          {
            preview: String,
            title: String,
            thumbnailUrl: String,
            isVisible: Boolean,
            offsetStart: Number,
            isFocused: Boolean,
            duration: Number,
            leftPosition: Number,
            topPosition: Number,
            dbId: String,
            id: Number,
            brollType: {
              type: String,
              enum: ['VIDEO', 'IMAGE', 'AI_PHOTO', 'SVG_INFOGRAPHIC']
            },
            perceptualHash: String,
            score: Number,
            link: {
              type: String,
              index: true
            },
            type: {
              type: String,
              enum: ['pexels', 'pinecone']
            }
          }
        ],
        timeStart: Number,
        timeEnd: Number,
        keywords: String
      }
    ],
    highlightId: String,
    highlightInstanceId: {
      type: mongoose.Schema.ObjectId,
      index: true,
      ref: 'HighlightInstance2'
    },
    highlightSegments: [
      {
        start: Number,
        end: Number
      }
    ],
    // @ts-ignore
    transcriptionJob: {
      type: mongoose.Schema.ObjectId,
      index: true,
      ref: 'TranscriptionJob'
    },
    source: {
      url: String,
      metadata: mongoose.Schema.Types.Mixed,
      thumbnail: String
    },
    croppedInfo: [
      {
        x1: Number,
        x2: Number,
        y1: Number,
        y2: Number,
        frameStart: Number,
        frameEnd: Number,
        timeStart: Number,
        timeEnd: Number
      }
    ],

    audio: [
      {
        id: Number,
        preview: String,
        title: String,
        audioType: String,
        thumbnailUrl: String,
        waveformUrl: String,
        duration: Number,
        bpm: Number
      }
    ],
    captions: {
      primaryColor: String,
      outlineColor: String,
      highlightedWordColor: String,
      fontFamily: String,
      isUppercase: Boolean,
      maxCharactersPerLine: Number,
      letterSpacing: Number,
      shadow: Number,
      numberOfLines: Number,
      backgroundColor: String,
      name: String,
      type: {
        type: String,
        enum: ['WORD_HIGHLIGHT', 'WORD_APPEAR', 'WORD_BACKGROUND']
      },
      fontSize: Number,
      verticalFontSize: Number,
      verticalActiveWordFontSize: Number,
      activeWordFontSize: Number,
      marginV: Number,
      outlineWidth: Number
    },
    audioEnabled: Boolean,
    audioIndex: { type: Number, default: 0 },
    editedWordsList: [
      {
        word: String,
        start: Number,
        end: Number,
        confidence: Number,
        wordIndex: Number,
        punctuated_word: String,
        speaker: Number,
        speaker_confidence: Number,
        isVisible: Boolean,
        isParagraphEnd: Boolean
      }
    ],
    publicLibraryIds: [String],
    privateLibraryIds: [String],
    voiceOver: String,
    audioVolume: {
      type: Number,
      default: 0.1
    },
    userId: {
      type: String,
      index: true
    }
  },
  { timestamps: true }
);

videoAiDataSchema.virtual('reviews', {
  ref: 'ReviewRevision', // The model to use
  localField: '_id', // Find ReviewRevision where `localField`
  foreignField: 'videoDataId', // is equal to `foreignField`
  justOne: false // set to false since we want to retrieve multiple ReviewRevisions
});

// Ensure virtual fields are included in the output
videoAiDataSchema.set('toObject', { virtuals: true });
videoAiDataSchema.set('toJSON', { virtuals: true });

export const VideoAIData = mongoose.model('VideoAIData2', videoAiDataSchema);
