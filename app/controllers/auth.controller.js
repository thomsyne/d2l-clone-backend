const { PubSub } = require("@google-cloud/pubsub");
const pubsub = new PubSub({projectId: 'arctic-cyclist-398917'});

const db = require("../models");
const config = require("../config/auth.config");
const User = db.user;
const Role = db.role;
const Otp = db.otp;

const Op = db.Sequelize.Op;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

exports.signup = (req, res) => {
  // Save User to Database
  User.create({
    email: req.body.email,
    dob: req.body.dob,
    full_name: req.body.full_name,
    image_url: req.body.image_url,
    password: bcrypt.hashSync(req.body.password, 8),
  })
    .then((user) => {
      if (req.body.roles) {
        Role.findAll({
          where: {
            name: {
              [Op.or]: req.body.roles,
            },
          },
        }).then((roles) => {
          user.setRoles(roles).then(() => {
            res.send({ message: "User was registered successfully!" });
          });
        });
      } else {
        // user role = 1
        user.setRoles([1]).then(() => {
          res.send({ message: "User was registered successfully!" });
        });
      }
    })
    .catch((err) => {
      res.status(500).send({ message: err.message });
    });
};

exports.signin = (req, res) => {
  User.findOne({
    where: {
      email: req.body.email,
    },
  })
    .then(async (user) => {
      if (!user) {
        return res.status(404).send({ message: "User Not found." });
      }

      var passwordIsValid = bcrypt.compareSync(
        req.body.password,
        user.password
      );

      if (!passwordIsValid) {
        return res.status(401).send({
          accessToken: null,
          message: "Invalid Password!",
        });
      }

      // START: OTP Creation
      let code = Math.floor(100000 + Math.random() * 900000);
      let isOTPSent = false;

      await Otp.create({
        user_id: user.user_id,
        otp_code: code,
        expiration_time: new Date(Date.now() + 1000 * 60 * 1),
        is_used: false,
      }).then((otp) => {
        console.log("OTP Created Successfully! " + otp.otp_code);
      });

      const data = {
        email: user.email,
        code: code,
        message_type: "otp",
        message: `Hi, ${user.full_name}! \nYour OTP is ${code}. \nIt expires in 5 minutes.`,
      };
      const dataBuffer = Buffer.from(JSON.stringify(data));
      console.log("The code is " + code)

      await pubsub
        .topic("d2l-messaging")
        .publish(dataBuffer)
        .then((messageId) => {
          isOTPSent = true;
          console.log(`Message published with ID: ${messageId}`);
          // Handle success
        })
        .catch((error) => {
          console.error("Error publishing message:", error);
          // Handle error
        });

      // END: OTP Creation

      const token = jwt.sign(
        { id: user.id, email: user.email },
        config.secret,
        {
          algorithm: "HS256",
          allowInsecureKeySizes: true,
          expiresIn: 86400, // 24 hours
        }
      );

      var authorities = [];
      user.getRoles().then((roles) => {
        for (let i = 0; i < roles.length; i++) {
          authorities.push("ROLE_" + roles[i].name.toUpperCase());
        }
        res.status(200).send({
          id: user.id,
          user_id: user.user_id,
          email: user.email,
          roles: authorities,
          accessToken: token,
          message: isOTPSent ? "OTP was sent successfully!" : "OTP was not sent!",
        });
      });
    })
    .catch((err) => {
      res.status(500).send({ message: err.message });
    });
};

exports.otp = (req, res) => {
  Otp.findOne({
    where: {
      user_id: req.body.user_id,
    },
    order: [['updatedAt', 'DESC']],
  })
    .then((otp) => {

      // Check if OTP exists
      if (!otp || otp.otp_code!= req.body.otp_code) {
        return res.status(404).send({ message: "Invalid OTP." });
      }

      if(otp.is_used) {
        return res.status(404).send({ message: "OTP has been used." });
      }

      // Compare the current time in UTC with the target timestamp
      const currentTime = new Date().toString();

      console.log("Current Time UTC: " + currentTime);
      console.log("Expiration Time: " + otp.expiration_time);

      if (new Date(currentTime) > new Date(otp.expiration_time)) {
        return res.status(404).send({ message: "OTP Expired." });
      }

      otp.update({
        expiration_time: new Date(Date.now()),
        is_used: true,
      }).then((status) => {
        res.status(200).send({
          message: "Login Successful!",
        });
      })
    })
}
