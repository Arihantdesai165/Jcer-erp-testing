import { DataTypes, Model } from 'sequelize';
import db from '../config/database';

class AcademicYear extends Model {
  public id!: string;
  public year!: string;
  public startDate!: Date;
  public endDate!: Date;
  public status!: 'ACTIVE' | 'UPCOMING' | 'ARCHIVED';
  public isCurrent!: boolean;
  public isOperational!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AcademicYear.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    year: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'UPCOMING', 'ARCHIVED'),
      allowNull: false,
      defaultValue: 'UPCOMING',
    },
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isOperational: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize: db,
    tableName: 'academic_years',
    timestamps: true,
    indexes: [
      { fields: ['year'], unique: true },
      { fields: ['status'] },
      { fields: ['isCurrent'] },
    ],
  }
);

export default AcademicYear;
