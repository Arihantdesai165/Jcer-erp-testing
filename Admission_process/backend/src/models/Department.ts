import { DataTypes, Model } from 'sequelize';
import db from '../config/database';

class Department extends Model {
  public id!: string;
  public name!: string;
  public code!: string;
  public type!: 'STANDARD' | 'SEMESTER_HANDLING';
  public handlingSemesters!: number[] | null;
  public activeSchemeId!: string | null;
  public attendanceThreshold!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Department.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'STANDARD',
    },
    handlingSemesters: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    activeSchemeId: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: null,
    },
    attendanceThreshold: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 85.0,
    },
  },
  {
    sequelize: db,
    tableName: 'departments',
    timestamps: true,
  }
);

export default Department;
