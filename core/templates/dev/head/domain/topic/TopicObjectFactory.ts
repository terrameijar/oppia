// Copyright 2018 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Factory for creating and mutating instances of frontend
 * topic domain objects.
 */

require('domain/skill/SkillSummaryObjectFactory.ts');
require('domain/topic/SubtopicObjectFactory.ts');
require('domain/topic/StoryReferenceObjectFactory.ts');

angular.module('oppia').factory('TopicObjectFactory', [
  'SkillSummaryObjectFactory', 'StoryReferenceObjectFactory',
  'SubtopicObjectFactory', function(
      SkillSummaryObjectFactory, StoryReferenceObjectFactory,
      SubtopicObjectFactory) {
    var Topic = function(
        id, name, description, languageCode, canonicalStoryReferences,
        additionalStoryReferences, uncategorizedSkillIds,
        nextSubtopicId, version, subtopics, skillIdToDescriptionMap) {
      this._id = id;
      this._name = name;
      this._description = description;
      this._languageCode = languageCode;
      this._canonicalStoryReferences = canonicalStoryReferences;
      this._additionalStoryReferences = additionalStoryReferences;
      this._uncategorizedSkillSummaries = uncategorizedSkillIds.map(
        function(skillId) {
          return SkillSummaryObjectFactory.create(
            skillId, skillIdToDescriptionMap[skillId]);
        });
      this._nextSubtopicId = nextSubtopicId;
      this._version = version;
      this._subtopics = angular.copy(subtopics);
    };

    // Instance methods

    Topic.prototype.getId = function() {
      return this._id;
    };

    Topic.prototype.getName = function() {
      return this._name;
    };

    Topic.prototype.setName = function(name) {
      this._name = name;
    };

    Topic.prototype.getDescription = function() {
      return this._description;
    };

    Topic.prototype.getNextSubtopicId = function() {
      return this._nextSubtopicId;
    };

    Topic.prototype.setDescription = function(description) {
      this._description = description;
    };

    Topic.prototype.getLanguageCode = function() {
      return this._languageCode;
    };

    Topic.prototype.setLanguageCode = function(languageCode) {
      this._languageCode = languageCode;
    };

    Topic.prototype.getVersion = function() {
      return this._version;
    };

    Topic.prototype.validate = function() {
      var issues = [];
      if (this._name === '') {
        issues.push('Topic name should not be empty.');
      }

      var subtopics = this._subtopics;
      var canonicalStoryIds = this.getCanonicalStoryIds();
      var additionalStoryIds = this.getAdditionalStoryIds();

      for (var i = 0; i < canonicalStoryIds.length; i++) {
        var storyId = canonicalStoryIds[i];
        if (canonicalStoryIds.indexOf(storyId) <
          canonicalStoryIds.lastIndexOf(storyId)) {
          issues.push(
            'The canonical story with id ' + storyId + ' is duplicated in' +
            ' the topic.');
        }
      }
      for (var i = 0; i < additionalStoryIds.length; i++) {
        var storyId = additionalStoryIds[i];
        if (additionalStoryIds.indexOf(storyId) <
          additionalStoryIds.lastIndexOf(storyId)) {
          issues.push(
            'The additional story with id ' + storyId + ' is duplicated in' +
            ' the topic.');
        }
      }
      for (var i = 0; i < canonicalStoryIds.length; i++) {
        if (additionalStoryIds.indexOf(canonicalStoryIds[i]) !== -1) {
          issues.push(
            'The story with id ' + canonicalStoryIds[i] +
            ' is present in both canonical and additional stories.');
        }
      }
      var topicSkillIds = angular.copy(
        this._uncategorizedSkillSummaries.map(function(skillSummary) {
          return skillSummary.getId();
        }));
      for (var i = 0; i < subtopics.length; i++) {
        issues = issues.concat(subtopics[i].validate());
        var skillIds = subtopics[i].getSkillSummaries().map(
          function(skillSummary) {
            return skillSummary.getId();
          }
        );
        for (var j = 0; j < skillIds.length; j++) {
          if (topicSkillIds.indexOf(skillIds[j]) === -1) {
            topicSkillIds.push(skillIds[j]);
          } else {
            issues.push(
              'The skill with id ' + skillIds[j] +
              ' is duplicated in the topic');
          }
        }
      }
      return issues;
    };

    Topic.prototype.getSkillIds = function() {
      var topicSkillIds = angular.copy(
        this._uncategorizedSkillSummaries.map(function(skillSummary) {
          return skillSummary.getId();
        }));

      var subtopics = this._subtopics;
      for (var i = 0; i < subtopics.length; i++) {
        topicSkillIds = topicSkillIds.concat(
          subtopics[i].getSkillSummaries().map(
            function(skillSummary) {
              return skillSummary.getId();
            })
        );
      }
      return topicSkillIds;
    };

    Topic.prototype.getSubtopicById = function(subtopicId) {
      for (var i = 0; i < this._subtopics.length; i++) {
        var id = this._subtopics[i].getId();
        if (id === subtopicId) {
          return this._subtopics[i];
        }
      }
      return null;
    };

    // Adds a new frontend subtopic domain object to this topic.
    Topic.prototype.addSubtopic = function(title) {
      var newSubtopic = SubtopicObjectFactory.createFromTitle(
        this._nextSubtopicId, title);
      this._subtopics.push(newSubtopic);
      this._nextSubtopicId++;
    };

    // Attempts to remove a subtopic from this topic given the
    // subtopic ID.
    Topic.prototype.deleteSubtopic = function(subtopicId, isNewlyCreated) {
      var subtopicDeleted = false;
      for (var i = 0; i < this._subtopics.length; i++) {
        if (this._subtopics[i].getId() === subtopicId) {
          // When a subtopic is deleted, all the skills in it are moved to
          // uncategorized skill ids.
          var skillSummaries = this._subtopics[i].getSkillSummaries();
          for (var j = 0; j < skillSummaries.length; j++) {
            var skillId = skillSummaries[j].getId();
            var skillDescription = skillSummaries[j].getDescription();
            if (!this.hasUncategorizedSkill(skillId)) {
              this._uncategorizedSkillSummaries.push(
                SkillSummaryObjectFactory.create(skillId, skillDescription));
            }
          }
          this._subtopics.splice(i, 1);
          subtopicDeleted = true;
          break;
        }
      }
      if (!subtopicDeleted) {
        throw Error('Subtopic to delete does not exist');
      }
      if (isNewlyCreated) {
        for (var i = 0; i < this._subtopics.length; i++) {
          if (this._subtopics[i].getId() > subtopicId) {
            this._subtopics[i].decrementId();
          }
        }
        this._nextSubtopicId--;
      }
    };

    Topic.prototype.clearSubtopics = function() {
      this._subtopics.length = 0;
    };

    Topic.prototype.getSubtopics = function() {
      return this._subtopics.slice();
    };

    Topic.prototype.getCanonicalStoryReferences = function() {
      return this._canonicalStoryReferences.slice();
    };

    Topic.prototype.getCanonicalStoryIds = function() {
      return this._canonicalStoryReferences.map(
        function(reference) {
          return reference.getStoryId();
        });
    };

    Topic.prototype.addCanonicalStory = function(storyId) {
      var canonicalStoryIds = this.getCanonicalStoryIds();
      if (canonicalStoryIds.indexOf(storyId) !== -1) {
        throw Error(
          'Given story id already present in canonical story ids.');
      }
      this._canonicalStoryReferences.push(
        StoryReferenceObjectFactory.createFromStoryId(storyId));
    };

    Topic.prototype.removeCanonicalStory = function(storyId) {
      var canonicalStoryIds = this.getCanonicalStoryIds();
      var index = canonicalStoryIds.indexOf(storyId);
      if (index === -1) {
        throw Error(
          'Given story id not present in canonical story ids.');
      }
      this._canonicalStoryReferences.splice(index, 1);
    };

    Topic.prototype.clearCanonicalStoryReferences = function() {
      this._canonicalStoryReferences.length = 0;
    };

    Topic.prototype.getAdditionalStoryIds = function() {
      return this._additionalStoryReferences.map(
        function(reference) {
          return reference.getStoryId();
        });
    };

    Topic.prototype.getAdditionalStoryReferences = function() {
      return this._additionalStoryReferences.slice();
    };

    Topic.prototype.addAdditionalStory = function(storyId) {
      var additionalStoryIds = this.getAdditionalStoryIds();
      if (additionalStoryIds.indexOf(storyId) !== -1) {
        throw Error(
          'Given story id already present in additional story ids.');
      }
      this._additionalStoryReferences.push(
        StoryReferenceObjectFactory.createFromStoryId(storyId));
    };

    Topic.prototype.removeAdditionalStory = function(storyId) {
      var additionalStoryIds = this.getAdditionalStoryIds();
      var index = additionalStoryIds.indexOf(storyId);
      if (index === -1) {
        throw Error(
          'Given story id not present in additional story ids.');
      }
      this._additionalStoryReferences.splice(index, 1);
    };

    Topic.prototype.clearAdditionalStoryReferences = function() {
      this._additionalStoryReferences.length = 0;
    };

    Topic.prototype.hasUncategorizedSkill = function(skillId) {
      return this._uncategorizedSkillSummaries.some(function(skillSummary) {
        return skillSummary.getId() === skillId;
      });
    };

    Topic.prototype.addUncategorizedSkill = function(
        skillId, skillDescription) {
      var skillIsPresentInSomeSubtopic = false;
      for (var i = 0; i < this._subtopics.length; i++) {
        if (this._subtopics[i].hasSkill(skillId)) {
          skillIsPresentInSomeSubtopic = true;
          break;
        }
      }
      if (skillIsPresentInSomeSubtopic) {
        throw Error('Given skillId is already present in a subtopic.');
      }
      if (this.hasUncategorizedSkill(skillId)) {
        throw Error('Given skillId is already an uncategorized skill.');
      }
      this._uncategorizedSkillSummaries.push(
        SkillSummaryObjectFactory.create(skillId, skillDescription));
    };

    Topic.prototype.removeUncategorizedSkill = function(skillId) {
      var index = this._uncategorizedSkillSummaries.map(function(skillSummary) {
        return skillSummary.getId();
      }).indexOf(skillId);
      if (index === -1) {
        throw Error('Given skillId is not an uncategorized skill.');
      }
      this._uncategorizedSkillSummaries.splice(index, 1);
    };

    Topic.prototype.clearUncategorizedSkills = function() {
      this._uncategorizedSkillSummaries.length = 0;
    };

    Topic.prototype.getUncategorizedSkillSummaries = function() {
      return this._uncategorizedSkillSummaries.slice();
    };

    // Reassigns all values within this topic to match the existing
    // topic. This is performed as a deep copy such that none of the
    // internal, bindable objects are changed within this topic.
    Topic.prototype.copyFromTopic = function(otherTopic) {
      this._id = otherTopic.getId();
      this.setName(otherTopic.getName());
      this.setDescription(otherTopic.getDescription());
      this.setLanguageCode(otherTopic.getLanguageCode());
      this._version = otherTopic.getVersion();
      this._nextSubtopicId = otherTopic.getNextSubtopicId();
      this.clearAdditionalStoryReferences();
      this.clearCanonicalStoryReferences();
      this.clearUncategorizedSkills();
      this.clearSubtopics();

      this._canonicalStoryReferences = otherTopic.getCanonicalStoryReferences();
      this._additionalStoryReferences =
        otherTopic.getAdditionalStoryReferences();

      var uncategorizedSkillSummaries =
        otherTopic.getUncategorizedSkillSummaries();
      for (var i = 0; i < uncategorizedSkillSummaries.length; i++) {
        this.addUncategorizedSkill(
          uncategorizedSkillSummaries[i].getId(),
          uncategorizedSkillSummaries[i].getDescription());
      }

      this._subtopics = angular.copy(otherTopic.getSubtopics());
    };

    // Static class methods. Note that "this" is not available in static
    // contexts. This function takes a JSON object which represents a backend
    // topic python dict.
    // TODO(ankita240796): Remove the bracket notation once Angular2 gets in.
    /* eslint-disable dot-notation */
    Topic['create'] = function(topicBackendDict, skillIdToDescriptionDict) {
    /* eslint-enable dot-notation */
      var subtopics = topicBackendDict.subtopics.map(function(subtopic) {
        return SubtopicObjectFactory.create(subtopic, skillIdToDescriptionDict);
      });
      var canonicalStoryReferences =
        topicBackendDict.canonical_story_references.map(function(reference) {
          return StoryReferenceObjectFactory.createFromBackendDict(reference);
        });
      var additionalStoryReferences =
        topicBackendDict.additional_story_references.map(function(reference) {
          return StoryReferenceObjectFactory.createFromBackendDict(reference);
        });
      return new Topic(
        topicBackendDict.id, topicBackendDict.name,
        topicBackendDict.description, topicBackendDict.language_code,
        canonicalStoryReferences, additionalStoryReferences,
        topicBackendDict.uncategorized_skill_ids,
        topicBackendDict.next_subtopic_id, topicBackendDict.version,
        subtopics, skillIdToDescriptionDict
      );
    };

    // Create an interstitial topic that would be displayed in the editor until
    // the actual topic is fetched from the backend.
    // TODO(ankita240796): Remove the bracket notation once Angular2 gets in.
    /* eslint-disable dot-notation */
    Topic['createInterstitialTopic'] = function() {
    /* eslint-enable dot-notation */
      return new Topic(
        null, 'Topic name loading', 'Topic description loading',
        'en', [], [], [], 1, 1, [], {}
      );
    };
    return Topic;
  }
]);
