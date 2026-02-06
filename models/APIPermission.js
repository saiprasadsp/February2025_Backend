

module.exports=(sequelize,DataTypes)=>{
  const ApiPermit = sequelize.define(
    "ApiPermit",
    {
      id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
      user_id: { type: DataTypes.STRING, allowNull: false, unique: true},
      status: {type:DataTypes.STRING,allowNull:false}
    },
    {
      tableName: "api_permission",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  ApiPermit.associate = (models) => {
    ApiPermit.belongsTo(models.UserRole, { foreignKey: "role_id" });
    ApiPermit.hasMany(models.Retailer, { foreignKey: "reports_id", sourceKey: "reports_id" });
  };

  return ApiPermit;
}