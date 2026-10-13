import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import User from './User';

class DepartmentSetting extends Model {
  public id!: string;
  public departmentId!: string;
  public academicYear!: string;
  public attendanceThreshold!: number;
  public updatedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DepartmentSetting.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'departments',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    academicYear: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '2026-27',
    },
    attendanceThreshold: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 85.0,
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
  },
  {
    sequelize: db,
    tableName: 'department_settings',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['departmentId', 'academicYear'],
      },
    ],
  }
);

DepartmentSetting.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
DepartmentSetting.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });

export default DepartmentSetting;
