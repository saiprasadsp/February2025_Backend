// models/Distributor.js
module.exports = (sequelize, DataTypes) => {
  const Reports = sequelize.define("Reports", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    reporter_id: { type: DataTypes.STRING, allowNull: false, unique: true },
    reporter_name:{type: DataTypes.STRING, allowNull: false},
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    reporter_emp_id:{type:DataTypes.STRING,allowNull: false},
    user_type: { type: DataTypes.STRING, allowNull: false },
    reporter_mobile: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    reporter_email: { type: DataTypes.STRING, allowNull: false, unique: true },
    reporter_password: { type: DataTypes.STRING, allowNull: false },
    status:{type:DataTypes.STRING,allowNull:false}
  }, {
    tableName: "reports",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });

  Reports.associate = (models) => {
    Reports.belongsTo(models.UserRole, { foreignKey: "role_id" });
    Reports.hasMany(models.Retailer, { foreignKey: "reports_id", sourceKey: "reports_id" });
  };

  return Reports;
};
