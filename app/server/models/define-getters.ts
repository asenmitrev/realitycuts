import mongoose from 'mongoose';
mongoose.Schema.Types.ObjectId.get(v => {
  return v?.toString();
});
