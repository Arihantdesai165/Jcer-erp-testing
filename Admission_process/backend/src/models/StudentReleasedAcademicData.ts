import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import AcademicRelease from './AcademicRelease';
import Student from './Student';
import Subject from './Subject';

export class StudentReleasedAcademicData extends Model {
  public id!: string;
  public academicReleaseId!: string;
  public studentId!: string;
  public usn!: string;
  public studentName!: string | null;
  public subjectId!: string;
  public semester!: number;
  public academicYear!: string;
  public releaseType!: 'ATTENDANCE' | 'MARKS';
  public assessmentType!: string;
  public attendancePercentage!: number | null;
  public conductedClasses!: number | null;
  public attendedClasses!: number | null;
  public marksObtained!: number | null;
  public maxMarks!: number | null;
  public percentage!: number | null;
  public status!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly release?: AcademicRelease;
  public readonly student?: Student;
  public readonly subject?: Subject;
}

StudentReleasedAcademicData.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    academicReleaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'academic_releases',
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
    usn: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    studentName: {
      type: DataTypes.STRING(255),
      allowNull: true,
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
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    releaseType: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    assessmentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    attendancePercentage: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    conductedClasses: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    attendedClasses: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    marksObtained: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    maxMarks: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    percentage: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'student_released_academic_data',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['studentId', 'subjectId', 'academicYear', 'semester', 'releaseType', 'assessmentType'],
        name: 'uq_student_released_data_item',
      },
      {
        fields: ['studentId', 'releaseType', 'semester'],
        name: 'idx_student_released_data_lookup',
      },
      {
        fields: ['academicReleaseId'],
        name: 'idx_student_released_data_release_id',
      },
      {
        fields: ['usn'],
      },
    ],
  }
);

StudentReleasedAcademicData.belongsTo(AcademicRelease, { as: 'release', foreignKey: 'academicReleaseId' });
AcademicRelease.hasMany(StudentReleasedAcademicData, { as: 'releasedData', foreignKey: 'academicReleaseId' });
StudentReleasedAcademicData.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });
StudentReleasedAcademicData.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });

export default StudentReleasedAcademicData;
