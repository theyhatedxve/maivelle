import { StyleSheet } from 'react-native';
import { colors,radii,spacing,typography } from '../../../theme';
export const medicineStyles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},
  content:{width:'100%',maxWidth:960,alignSelf:'center',padding:spacing.xl,gap:spacing.lg,paddingBottom:spacing.xxl},
  section:{gap:spacing.md,marginBottom:spacing.lg},
  row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm},
  input:{...typography.body,color:colors.text,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.sm,padding:spacing.md,minHeight:50},
  body:{minHeight:110,textAlignVertical:'top'},
  notice:{padding:spacing.md,backgroundColor:colors.lavenderSoft,borderRadius:radii.sm,gap:spacing.sm},
  chip:{minHeight:44,padding:spacing.md,borderRadius:radii.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  selected:{borderColor:colors.primary,backgroundColor:colors.lavender},
});
