import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import BackArrowIcon from '../../assets/icons/back-arrow.svg';
import TagUserIcon from '../../assets/icons/tag-user.svg';
import { colors } from '../../constants/colors';

const COVER_WIDTH = 146;
const COVER_HEIGHT = 223;

export default function PostScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const [caption, setCaption] = useState('');

  const player = useVideoPlayer(uri ?? null, (instance) => {
    instance.loop = true;
  });

  function handlePreview() {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  function handleEditCover() {
    Alert.alert('Coming soon', 'Cover-frame picking isn’t wired up in this example yet.');
  }

  function handleTagPeople() {
    Alert.alert('Coming soon', 'People-tagging isn’t wired up in this example yet.');
  }

  function handleSaveDraft() {
    Alert.alert('Clip saved', 'Saved as a draft.', [
      { text: 'OK', onPress: () => router.dismissTo('/') },
    ]);
  }

  function handleShareClip() {
    Alert.alert('Clip shared', 'Your clip has been shared.', [
      { text: 'OK', onPress: () => router.dismissTo('/') },
    ]);
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrowIcon width={16} height={16} />
        </TouchableOpacity>
        <Text style={styles.title}>New Clip</Text>

        <View style={styles.coverSection}>
          <TouchableOpacity activeOpacity={0.9} onPress={handlePreview}>
            <VideoView
              player={player}
              style={styles.cover}
              nativeControls={false}
              contentFit="cover"
            />
          </TouchableOpacity>
          <View style={styles.coverButtonRow}>
            <TouchableOpacity style={styles.coverButton} onPress={handlePreview}>
              <Text style={styles.coverButtonText}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.coverButton, styles.editCoverButton]}
              onPress={handleEditCover}>
              <Text style={styles.coverButtonText}>Edit Cover</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.captionRow}>
          <View style={styles.captionAccent} />
          <TextInput
            style={styles.captionInput}
            placeholder="Add caption and description that best fit your Clip…"
            placeholderTextColor={colors.textSecondary}
            value={caption}
            onChangeText={setCaption}
            multiline
          />
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionRow} onPress={handleTagPeople}>
            <View style={styles.actionLabel}>
              <TagUserIcon width={24} height={24} />
              <Text style={styles.actionText}>Tag people</Text>
            </View>
            <BackArrowIcon width={16} height={16} style={styles.chevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveDraftButton} onPress={handleSaveDraft}>
            <Text style={styles.saveDraftText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareClip}>
            <Text style={styles.shareText}>Share Clip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgTertiary,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 56,
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
  },
  title: {
    marginTop: 56,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  coverSection: {
    marginTop: 20,
    alignItems: 'center',
    gap: 9,
  },
  cover: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: colors.mainColor,
    backgroundColor: '#000000',
  },
  coverButtonRow: {
    flexDirection: 'row',
    gap: 14,
  },
  coverButton: {
    height: 23,
    minWidth: 60,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCoverButton: {
    backgroundColor: colors.inputField,
    borderStyle: 'dashed',
  },
  coverButtonText: {
    fontSize: 8,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  captionRow: {
    marginTop: 24,
    marginHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
  },
  captionAccent: {
    width: 1,
    height: 23,
    borderRadius: 10,
    backgroundColor: colors.mainColor,
  },
  captionInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  actionsSection: {
    marginTop: 'auto',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: colors.stroke,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  chevron: {
    transform: [{ rotate: '180deg' }],
  },
  footer: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
    borderTopWidth: 0.5,
    borderTopColor: colors.stroke,
  },
  saveDraftButton: {
    flex: 1,
    height: 50,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDraftText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  shareButton: {
    flex: 1,
    height: 50,
    borderRadius: 100,
    backgroundColor: colors.mainColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 14,
    color: colors.white,
  },
});
