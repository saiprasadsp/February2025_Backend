// models/Superdistributor.js
module.exports = (sequelize, DataTypes) => {
  const Superdistributor = sequelize.define("Superdistributor", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    superdistributor_id: { type: DataTypes.STRING, allowNull: false, unique: true },
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    user_type: { type: DataTypes.STRING, allowNull: false },
    name_as_per_aadhaar: { type: DataTypes.STRING, allowNull: false },
    aadhar_number: { type: DataTypes.STRING(20), allowNull: false },
    dob: { type: DataTypes.DATE, allowNull: false },
    gender: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: true },
    state: { type: DataTypes.STRING, allowNull: true },
    district: { type: DataTypes.STRING, allowNull: true },
    pincode: { type: DataTypes.STRING, allowNull: true },
    user_mobile: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    user_email: { type: DataTypes.STRING, allowNull: false, unique: true },
    user_password: { type: DataTypes.STRING, allowNull: false },
    aadhar_url: { type: DataTypes.STRING(1000), allowNull: true },
    pan_number: { type: DataTypes.STRING(10), allowNull: true },
    name_as_per_pan: { type: DataTypes.STRING, allowNull: true },
    pan_url: { type: DataTypes.STRING(1000), allowNull: true },
    business_name: { type: DataTypes.STRING, allowNull: true },
    business_category: { type: DataTypes.STRING, allowNull: true },
    business_address: { type: DataTypes.STRING, allowNull: true },
    business_state: { type: DataTypes.STRING, allowNull: true },
    business_district: { type: DataTypes.STRING, allowNull: true },
    business_pincode: { type: DataTypes.STRING, allowNull: true },
    business_labour_license_Number: { type: DataTypes.STRING, allowNull: true },
    business_proprietor_name: { type: DataTypes.STRING, allowNull: true },
    shop_photo_url: { type: DataTypes.STRING(1000), allowNull: true },
    business_ll_url: { type: DataTypes.STRING(1000), allowNull: true },
    profile_photo_url: { type: DataTypes.STRING(1000), allowNull: true },
    bank_name: { type: DataTypes.STRING, allowNull: true },
    account_number: { type: DataTypes.STRING, allowNull: true },
    ifsc_code: { type: DataTypes.STRING, allowNull: true },
    account_holder_name: { type: DataTypes.STRING, allowNull: true },
    cancelled_check_url: { type: DataTypes.STRING(1000), allowNull: true },
    doj: { type: DataTypes.DATE, allowNull: false },
    kyc_status: { type: DataTypes.STRING, defaultValue: "Pending" },
    superdistributor_status: { type: DataTypes.STRING, allowNull: true },
    comments: { type: DataTypes.STRING, allowNull: true },
    superdistributor_margin: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: "superdistributor",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  });

  Superdistributor.associate = (models) => {
    Superdistributor.belongsTo(models.UserRole, { foreignKey: "role_id" });
    Superdistributor.hasMany(models.Retailer, { foreignKey: "distributor_id", sourceKey: "distributor_id" });
  };

  return Superdistributor;
};
