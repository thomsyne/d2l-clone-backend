module.exports = (sequelize, Sequelize) => {
    const Otp = sequelize.define("otp", {
      otp_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id',
          },
      },
      otp_code: {
        type: Sequelize.INTEGER(6),
        allowNull: false,
      },
      expiration_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      is_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });
  
    return Otp;
  };
  