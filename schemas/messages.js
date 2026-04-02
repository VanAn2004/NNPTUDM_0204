const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    messageContent: {
      type: {
        type: String,
        enum: ["text", "file"],
        required: true,
      },
      text: {
        type: String,
        required: true,
      },
    },
  },
  { timestamps: true }
);

// Index để query nhanh theo cặp (from, to) — rất quan trọng với chat
messageSchema.index({ from: 1, to: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("message", messageSchema);