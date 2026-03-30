// models/Payments.js
module.exports = (sequelize, DataTypes) => {
  const GateWays = sequelize.define(
    "GateWays",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      super_distributor: { type: DataTypes.FLOAT },
      distributor: { type: DataTypes.FLOAT, },
      retailer: { type: DataTypes.FLOAT, },
      code:{type:DataTypes.STRING}
    },
    {
      tableName: "payment_gateways",
      timestamps:true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return GateWays;
};
