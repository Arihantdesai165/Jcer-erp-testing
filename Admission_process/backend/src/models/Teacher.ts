import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';
import Department from './Department';

class Teacher extends Model {
  public id!: string;
  public userId!: string;
  public departmentId!: string;
  public designation!: string;
  public middleName!: string | null;
  public gender!: string | null;
  public cycle!: 'P_CYCLE' | 'C_CYCLE' | string | null;
  public status!: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  public archivedAt!: Date | null;
  public archivedBy!: string | null;
  public joiningDate!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public user?: User;
  public department?: Department;
  public archivedByUser?: User;
}

Teacher.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Department,
        key: 'id',
      },
    },
    designation: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    middleName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    gender: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    cycle: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    archivedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    joiningDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize: db,
    tableName: 'teachers',
    timestamps: true,
  }
);

Teacher.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Teacher.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
Teacher.belongsTo(User, { as: 'archivedByUser', foreignKey: 'archivedBy' });

export default Teacher;
