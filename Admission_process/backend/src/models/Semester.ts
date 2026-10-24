import { DataTypes, Model } from 'sequelize';
import db from '../config/database';

class Semester extends Model {
  public id!: string;
  public semesterNumber!: number;
  public semesterName!: string;
  public academicYear!: string;
  public startDate!: Date;
  public endDate!: Date;
  public status!: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Semester.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    semesterNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    semesterName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
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
      type: DataTypes.ENUM('ACTIVE', 'UPCOMING', 'COMPLETED'),
      allowNull: false,
      defaultValue: 'UPCOMING',
    },
  },
  {
    sequelize: db,
    tableName: 'semesters',
    timestamps: true,
    indexes: [
      { fields: ['academicYear', 'semesterNumber'], unique: true },
      { fields: ['status'] },
    ],
  }
);

export default Semester;
