import mongoose from 'mongoose';
import { CaptionSettings } from '../types';
import './define-getters';

const captionSchema = new mongoose.Schema<CaptionSettings>(
  {
    type: {
      type: String,
      enum: ['WORD_HIGHLIGHT', 'WORD_APPEAR', 'WORD_BACKGROUND']
    },
    fontFamily: String,
    name: String,
    isUppercase: Boolean,
    primaryColor: String,
    outlineColor: String,
    backgroundColor: String,
    numberOfLines: Number,
    fontSize: Number,
    verticalFontSize: Number,
    letterSpacing: Number,
    activeWordFontSize: Number,
    verticalActiveWordFontSize: Number,
    maxCharactersPerLine: Number,
    userId: String,
    isDefault: Boolean,
    shadow: {
      type: Number,
      enum: [0, 1, 2, 3, 4]
    },
    highlightedWordColor: String,
    marginV: Number,
    outlineWidth: Number
  },
  { timestamps: true }
);

export const Caption = mongoose.model('Caption', captionSchema);
