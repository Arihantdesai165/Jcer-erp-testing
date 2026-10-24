import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';

class Subject extends Model {
  public id!: string;
  public name!: string;
  public code!: string;
  public semester!: number;
  public departmentId!: string | null;
  public credits!: number;
  public type!: 'IPCC' | 'CC' | string;
  public cycle!: 'P_CYCLE' | 'C_CYCLE' | string | null;
  public schemeId!: string;
  public status!: 'ACTIVE' | 'INACTIVE';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Subject.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(25),
      allowNull: false,
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'departments',
        key: 'id',
      },
    },
    credits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'IPCC',
    },
    cycle: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    schemeId: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: '2025',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize: db,
    tableName: 'subjects',
    timestamps: true,
    indexes: [
      {
        fields: ['code'],
      },
      {
        fields: ['semester'],
      },
      {
        fields: ['departmentId'],
      },
      {
        fields: ['schemeId'],
      },
      {
        fields: ['cycle'],
      },
    ],
  }
);

Subject.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });

export default Subject;
