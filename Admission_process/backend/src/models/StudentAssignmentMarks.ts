import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import AssignmentConfiguration from './AssignmentConfiguration';
import Student from './Student';
import User from './User';

class StudentAssignmentMarks extends Model {
  public id!: string;
  public assignmentConfigurationId!: string;
  public studentId!: string;
  public componentId!: string;
  public marksObtained!: number | null;
  public recordStatus!: 'SAVED' | 'DRAFT';
  public updatedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public assignmentConfiguration?: AssignmentConfiguration;
  public student?: Student;
  public updater?: User;
}

StudentAssignmentMarks.init(
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
    componentId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    marksObtained: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    recordStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'SAVED',
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
    tableName: 'student_assignment_marks',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['assignmentConfigurationId', 'studentId', 'componentId'],
        name: 'uq_student_assignment_comp_mark',
      },
      { fields: ['assignmentConfigurationId'] },
      { fields: ['studentId'] },
    ],
  }
);

StudentAssignmentMarks.belongsTo(AssignmentConfiguration, {
  as: 'assignmentConfiguration',
  foreignKey: 'assignmentConfigurationId',
});
StudentAssignmentMarks.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });
StudentAssignmentMarks.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

AssignmentConfiguration.hasMany(StudentAssignmentMarks, {
  as: 'assignmentMarks',
  foreignKey: 'assignmentConfigurationId',
});
Student.hasMany(StudentAssignmentMarks, {
  as: 'studentAssignmentMarks',
  foreignKey: 'studentId',
});

export default StudentAssignmentMarks;
