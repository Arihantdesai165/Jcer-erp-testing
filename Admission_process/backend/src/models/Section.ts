import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';

import User from './User';

class Section extends Model {
  public id!: string;
  public departmentId!: string;
  public semester!: number;
  public academicYear!: string;
  public name!: string;
  public branch!: string | null;
  public capacity!: number;
  public classroom!: string | null;
  public description!: string | null;
  public createdBy!: string | null;
  public status!: 'ACTIVE' | 'INACTIVE';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Section.init(
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
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    branch: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
    },
    classroom: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize: db,
    tableName: 'sections',
    timestamps: true,
    indexes: [
      { fields: ['departmentId', 'semester', 'academicYear', 'branch', 'name'], unique: true },
      { fields: ['status'] },
    ],
  }
);

Section.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
Section.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

export default Section;
