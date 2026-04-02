const ExcelJS = require('exceljs');
const userController = require('../controllers/users');
const roleModel = require('../schemas/roles');
const { generatePassword } = require('../utils/passwordUtil');
const { sendMail } = require('../utils/mailHandler');

/**
 * Import users from an .xlsx file
 * @param {string} filePath - Path to the .xlsx file
 * @param {object} session - Mongoose session (optional)
 */
async function importUsersFromXlsx(filePath, session = null) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    // Find the role 'user'
    const userRole = await roleModel.findOne({ name: 'user', isDeleted: false });
    if (!userRole) throw new Error('Role "user" not found');

    // Assuming first row is header: username, email
    const users = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const username = row.getCell(1).value?.toString().trim();
        const email = row.getCell(2).value?.toString().trim();
        if (!username || !email) return;
        users.push({ username, email });
    });

    for (const { username, email } of users) {
        const password = generatePassword(16);
        // Create user
        const user = await userController.CreateAnUser(
            username,
            password,
            email,
            userRole._id,
            session,
            '', // fullname
            undefined, // avatarUrl
            false, // status
            0 // loginCount
        );
        // Send password via email
        const subject = 'Your new account password';
        const text = `Your account has been created.\nUsername: ${username}\nPassword: ${password}`;
        const html = `<p>Your account has been created.</p><p><b>Username:</b> ${username}<br/><b>Password:</b> ${password}</p>`;
        await sendMail(email, subject, text, html);
    }
    return users.length;
}

module.exports = { importUsersFromXlsx };