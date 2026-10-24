import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import AssignmentConfiguration from './AssignmentConfiguration';
import Student from './Student';

class StudentAssignmentSummary extends Model {
  public id!: string;
  public assignmentConfigurationId!: string;
  public studentId!: string;
  public rawTotal!: number;
  public scaledTotal!: number;
  public completionStatus!: 'INCOMPLETE' | 'COMPLETED';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public assignmentConfiguration?: AssignmentConfiguration;
  public student?: Student;
}

StudentAssignmentSummary.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assignmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'assignment_configurations',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'students',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    rawTotal: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    scaledTotal: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    completionStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'INCOMPLETE',
    },
  },
  {
    sequelize: db,
    tableName: 'student_assignment_summaries',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['assignmentConfigurationId', 'studentId'],
        name: 'uq_student_assignment_summary',
      },
      { fields: ['assignmentConfigurationId'] },
      { fields: ['studentId'] },
    ],
  }
);

StudentAssignmentSummary.belongsTo(AssignmentConfiguration, {
  as: 'assignmentConfiguration',
  foreignKey: 'assignmentConfigurationId',
});
StudentAssignmentSummary.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });

AssignmentConfiguration.hasMany(StudentAssignmentSummary, {
  as: 'summaries',
  foreignKey: 'assignmentConfigurationId',
});
Student.hasMany(StudentAssignmentSummary, {
  as: 'assignmentSummaries',
  foreignKey: 'studentId',
});

export default StudentAssignmentSummary;
