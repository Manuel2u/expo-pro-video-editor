import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import ColorFilterIcon from '../../assets/icons/colorfilter.svg';
import MicrophoneIcon from '../../assets/icons/microphone.svg';
import MusicIcon from '../../assets/icons/music.svg';
import { colors } from '../../constants/colors';

export type EditorToolbarAction = 'audio' | 'voice' | 'filter';

export function EditorToolbar(props: { onPressAction: (action: EditorToolbarAction) => void }) {
  const { onPressAction } = props;

  return (
    <View style={styles.row}>
      <ToolbarItem label="Audio" onPress={() => onPressAction('audio')}>
        <MusicIcon width={24} height={24} />
      </ToolbarItem>
      <ToolbarItem label="Voice" onPress={() => onPressAction('voice')}>
        <MicrophoneIcon width={24} height={24} />
      </ToolbarItem>
      <ToolbarItem label="Filter" onPress={() => onPressAction('filter')}>
        <ColorFilterIcon width={24} height={24} />
      </ToolbarItem>
    </View>
  );
}

function ToolbarItem(props: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity style={styles.item} onPress={props.onPress}>
      <View style={styles.circle}>{props.children}</View>
      <Text style={styles.label}>{props.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 26,
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    gap: 3,
    width: 40,
  },
  circle: {
    height: 40,
    width: 40,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: colors.stroke,
    backgroundColor: colors.inputField,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
