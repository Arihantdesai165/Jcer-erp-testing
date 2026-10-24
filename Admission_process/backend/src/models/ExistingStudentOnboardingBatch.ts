import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';
import Department from './Department';

class ExistingStudentOnboardingBatch extends Model {
  public id!: string;
  public fileName!: string;
  public academicYear!: string;
  public scheme!: string;
  public semester!: number;
  public departmentId!: string | null;
  public departmentCode!: string | null;
  public section!: string | null;
  public totalRecords!: number;
  public successfulRecords!: number;
  public failedRecords!: number;
  public status!: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  public importedBy!: string;
  public errors!: any; // JSON
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ExistingStudentOnboardingBatch.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    scheme: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'departments',
        key: 'id',
      },
    },
    departmentCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    section: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    totalRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    successfulRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedRecords: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('COMPLETED', 'FAILED', 'PARTIAL'),
      allowNull: false,
      defaultValue: 'COMPLETED',
    },
    importedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },
    errors: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'existing_student_onboarding_batches',
    timestamps: true,
    indexes: [
      { fields: ['academicYear'] },
      { fields: ['scheme'] },
      { fields: ['semester'] },
      { fields: ['status'] },
      { fields: ['importedBy'] },
      { fields: ['createdAt'] },
    ],
  }
);

ExistingStudentOnboardingBatch.belongsTo(User, { as: 'operator', foreignKey: 'importedBy' });
ExistingStudentOnboardingBatch.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });

export default ExistingStudentOnboardingBatch;
