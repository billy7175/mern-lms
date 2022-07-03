import User from '../models/user'
import { hashPassowrd, comparePassword } from '../utils/auth';
import jwt from "jsonwebtoken";
import { nanoid } from 'nanoid'
import AWS from "aws-sdk";

const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};

const SES = new AWS.SES(awsConfig);


console.log('#hashPassowrd', hashPassowrd)
console.log('#comparePassword', comparePassword)

export const register = async (req, res) => {
  try {
    console.log('####req.body', req.body)
    const { name, email, password } = req.body
    if (!name) return res.status(400).send('Name is required');

    if (!password || password.length < 6) {
      return res
        .status(400)
        .send('Password is required and should be min six characters')
    }
    let userExist = await User.findOne({ email }).exec();
    console.log('#userExist', userExist)
    if (userExist) return res.status(400).send('Email is taken');

    const hashedPassword = await hashPassowrd(password)

    const user = new User({
      name,
      email,
      password: hashedPassword
    })
    await user.save()
    console.log('@saved user', user)
    return res.json({ ok: true })

  } catch (error) {
    console.log(error);
    return res.status(400).send("Error. Try again.");
  }
}

export const login = async (req, res) => {
  try {
    // console.log(req.body);
    const { email, password } = req.body;
    // check if our db has user with that email
    const user = await User.findOne({ email }).exec();
    if (!user) return res.status(400).send("No user found");
    // check password
    const match = await comparePassword(password, user.password);
    // create signed jwt
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    // return user and token to client, exclude hashed password
    user.password = undefined;
    // send token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      // secure: true, // only works on https
    });
    // send user as json response
    res.json(user);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Error. Try again.");
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    return res.json({ message: "Sigout success" })
  } catch (error) {
    console.log('#logout', erorr)
  }
}

export const currentUser = async (req,res) => {
  try {
    const user = await User.findById(req.cookies.User._id).select("-password").exec();
    console.log('CURRENT_USER', user)
    return res.json({ok: true});
  } catch (error) {
    console.log('#currentUser: error ', error)
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    // console.log(email);
    const shortCode = nanoid(6).toUpperCase();
    // const shortCode = "123456"
    const user = await User.findOneAndUpdate(
      { email },
      { passwordResetCode: shortCode }
    );
    if (!user) return res.status(400).send("User not found");

    // prepare for email
    const params = {
      Source: process.env.EMAIL_FROM,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
                <html>
                  <h1>Reset password</h1>
                  <p>User this code to reset your password</p>
                  <h2 style="color:red;">${shortCode}</h2>
                  <i>edemy.com</i>
                </html>
              `,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Reset Password",
        },
      },
    };

    const emailSent = SES.sendEmail(params).promise();
    emailSent
      .then((data) => {
        console.log(data);
        res.json({ ok: true });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log(err);
  }
};

export const sendTestEmail = async (req, res) => {
  // console.log("send email using SES");
  // res.json({ ok: true });
  const params = {
    Source: process.env.EMAIL_FROM,
    Destination: {
      ToAddresses: ["billy7175@naver.com"],
    },
    ReplyToAddresses: [process.env.EMAIL_FROM],
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
            <html>
              <h1>Lisa's English School</h1>
              <h2>Reset password link</h2>
              <p>Please use the following link to reset your password</p>
            </html>
          `,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Password reset link",
      },
    },
  };

  const emailSent = SES.sendEmail(params).promise();

  emailSent
    .then((data) => {
      console.log(data);
      res.json({ ok: true });
    })
    .catch((err) => {
      console.log(err);
    });
};
