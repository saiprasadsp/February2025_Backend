const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

// Import models
const User = require("./User")(sequelize, DataTypes);
const UserRole = require("./UserRole")(sequelize, DataTypes);
const UserAudit = require("./UserAudit")(sequelize, DataTypes);
const Superdistributor = require("./Superdistributor")(sequelize, DataTypes);
const Distributor = require("./Distributor")(sequelize, DataTypes);
const Retailer = require("./Retailer")(sequelize, DataTypes);
const Transaction = require('./Transaction')(sequelize,DataTypes)
const Wallet = require('./Wallet')(sequelize,DataTypes)
const Contact = require('./Contact')(sequelize,DataTypes)
const BankDetails = require('./BankDetails')(sequelize,DataTypes)
const CardDetails = require('./CardDetails')(sequelize,DataTypes)
const Payments = require('./Payments')(sequelize,DataTypes)


// Define associations
User.belongsTo(UserRole, { foreignKey: "role_id" });
UserRole.hasMany(User, { foreignKey: "role_id" });
Wallet.belongsTo(Retailer, {
  foreignKey: "wallet_user_id",
  targetKey: "retailer_id",
});

// models/Retailer.js
Retailer.hasOne(Wallet, {
  foreignKey: "wallet_user_id",
  sourceKey: "retailer_id",
});


module.exports = {
  sequelize,
  User,
  UserRole,
  Transaction,
  Wallet,
  Contact,
  UserAudit,
  Superdistributor,
  Distributor,
  Retailer,
  BankDetails,
  CardDetails,
  Payments
};
