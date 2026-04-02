const express = require("express");
const router = express.Router();
const Message = require("../schemas/messages");
const { checkLogin } = require("../utils/authHandler");
const uploadHandler = require("../utils/uploadHandler");

// ─── GET / ───────────────────────────────────────────────────────────────────
// Lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện mà user hiện tại tham gia
router.get("/", checkLogin, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Aggregate: gom tất cả message liên quan đến currentUser
    // rồi group theo "cặp hội thoại", lấy message mới nhất mỗi cặp
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ from: currentUserId }, { to: currentUserId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        // Tạo key chuẩn hóa cho cặp (A-B và B-A đều ra cùng key)
        $addFields: {
          conversationKey: {
            $cond: {
              if: { $lt: ["$from", "$to"] },
              then: { $concat: [{ $toString: "$from" }, "_", { $toString: "$to" }] },
              else: { $concat: [{ $toString: "$to" }, "_", { $toString: "$from" }] },
            },
          },
        },
      },
      {
        // Group theo key, lấy document đầu tiên (đã sort desc = mới nhất)
        $group: {
          _id: "$conversationKey",
          lastMessage: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$lastMessage" } },
      { $sort: { createdAt: -1 } },
    ]);

    // Populate from/to sau aggregate
    const populated = await Message.populate(conversations, [
      { path: "from", select: "username fullName avatarUrl" },
      { path: "to", select: "username fullName avatarUrl" },
    ]);

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /:userID ─────────────────────────────────────────────────────────────
// Lấy toàn bộ tin nhắn giữa user hiện tại và userID
router.get("/:userID", checkLogin, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userID } = req.params;

    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: userID },
        { from: userID, to: currentUserId },
      ],
    })
      .sort({ createdAt: 1 }) // Cũ -> Mới, đúng thứ tự chat
      .populate("from", "username fullName avatarUrl")
      .populate("to", "username fullName avatarUrl");

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST / ──────────────────────────────────────────────────────────────────
// Gửi tin nhắn (text hoặc file)
// Body (multipart/form-data hoặc JSON):
//   - to: userID đích
//   - text: nội dung (nếu gửi text)
//   - file: file upload (nếu gửi file)
router.post(
  "/",
  checkLogin,
  uploadHandler.uploadAny.single("file"), // multer xử lý file nếu có
  async (req, res) => {
    try {
      const currentUserId = req.user._id;
      const { to, text } = req.body;

      if (!to) {
        return res.status(400).json({ success: false, message: "Thiếu người nhận (to)" });
      }

      let messageContent;

      if (req.file) {
        // Có file upload → type = "file", text = đường dẫn file
        messageContent = {
          type: "file",
          text: req.file.path, // vd: "uploads/1774513816999-582557723.png"
        };
      } else if (text && text.trim()) {
        // Không có file → type = "text"
        messageContent = {
          type: "text",
          text: text.trim(),
        };
      } else {
        return res.status(400).json({ success: false, message: "Thiếu nội dung tin nhắn" });
      }

      const newMessage = await Message.create({
        from: currentUserId,
        to,
        messageContent,
      });

      const populated = await newMessage.populate([
        { path: "from", select: "username fullName avatarUrl" },
        { path: "to", select: "username fullName avatarUrl" },
      ]);

      res.status(201).json({ success: true, data: populated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;