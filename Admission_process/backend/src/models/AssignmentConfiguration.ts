import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import Subject from './Subject';
import User from './User';

export interface AssignmentComponentDef {
  id: string; // e.g. 'a1'
  label: string; // e.g. 'Assignment 1'
  maxMarks: number; // e.g. 5
}

export interface AssignmentCalculationPolicy {
  type: 'SUM' | 'WEIGHTED_AVERAGE';
  scaledMaxMarks?: number; // e.g. 25
}

class AssignmentConfiguration extends Model {
  public id!: string;
  public departmentId!: string;
  public semester!: number;
  public academicYear!: string;
  public subjectId!: string;
  public maximumMarks!: number;
  public components!: AssignmentComponentDef[];
  public calculationPolicy!: AssignmentCalculationPolicy;
  public status!: 'DRAFT' | 'SAVED' | 'FINALIZED';
  public createdBy!: string | null;
  public updatedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public department?: Department;
  public subject?: Subject;
  public creator?: User;
  public updater?: User;
}

AssignmentConfiguration.init(
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
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '2026-27',
    },
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'subjects',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    maximumMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 25.0,
    },
    components: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [
        { id: 'a1', label: 'Assignment 1', maxMarks: 5 },
        { id: 'a2', label: 'Assignment 2', maxMarks: 5 },
        { id: 'a3', label: 'Assignment 3', maxMarks: 5 },
        { id: 'a4', label: 'Assignment 4', maxMarks: 5 },
        { id: 'a5', label: 'Assignment 5', maxMarks: 5 },
      ],
    },
    calculationPolicy: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { type: 'SUM', scaledMaxMarks: 25 },
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'SAVED',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
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
    tableName: 'assignment_configurations',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['academicYear', 'departmentId', 'semester', 'subjectId'],
        name: 'uq_assignment_config_context',
      },
      { fields: ['subjectId'] },
      { fields: ['departmentId'] },
    ],
  }
);

AssignmentConfiguration.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
AssignmentConfiguration.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
AssignmentConfiguration.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
AssignmentConfiguration.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

export default AssignmentConfiguration;
