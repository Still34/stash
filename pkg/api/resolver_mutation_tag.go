package api

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/stashapp/stash/pkg/manager"
	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

func (r *mutationResolver) TagCreate(ctx context.Context, input models.TagCreateInput) (*models.Tag, error) {
	// Populate a new tag from the input
	currentTime := time.Now()
	newTag := models.Tag{
		Name:      input.Name,
		CreatedAt: models.SQLiteTimestamp{Timestamp: currentTime},
		UpdatedAt: models.SQLiteTimestamp{Timestamp: currentTime},
	}

	var imageData []byte
	var err error

	if input.Image != nil {
		imageData, err = utils.ProcessImageInput(*input.Image)

		if err != nil {
			return nil, err
		}
	}

	// Start the transaction and save the tag
	var tag *models.Tag
	if err := r.withTxn(ctx, func(repo models.Repository) error {
		qb := repo.Tag()

		// ensure name is unique
		if err := manager.EnsureTagNameUnique(newTag, qb); err != nil {
			return err
		}

		tag, err = qb.Create(newTag)
		if err != nil {
			return err
		}

		// update image table
		if len(imageData) > 0 {
			if err := qb.UpdateImage(tag.ID, imageData); err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return tag, nil
}

func (r *mutationResolver) TagUpdate(ctx context.Context, input models.TagUpdateInput) (*models.Tag, error) {
	// Populate tag from the input
	tagID, err := strconv.Atoi(input.ID)
	if err != nil {
		return nil, err
	}

	updatedTag := models.Tag{
		ID:        tagID,
		Name:      input.Name,
		UpdatedAt: models.SQLiteTimestamp{Timestamp: time.Now()},
	}

	var imageData []byte

	translator := changesetTranslator{
		inputMap: getUpdateInputMap(ctx),
	}

	imageIncluded := translator.hasField("image")
	if input.Image != nil {
		imageData, err = utils.ProcessImageInput(*input.Image)

		if err != nil {
			return nil, err
		}
	}

	// Start the transaction and save the tag
	var tag *models.Tag
	if err := r.withTxn(ctx, func(repo models.Repository) error {
		qb := repo.Tag()

		// ensure name is unique
		existing, err := qb.Find(tagID)
		if err != nil {
			return err
		}

		if existing == nil {
			return fmt.Errorf("Tag with ID %d not found", tagID)
		}

		if existing.Name != updatedTag.Name {
			if err := manager.EnsureTagNameUnique(updatedTag, qb); err != nil {
				return err
			}
		}

		tag, err = qb.Update(updatedTag)
		if err != nil {
			return err
		}

		// update image table
		if len(imageData) > 0 {
			if err := qb.UpdateImage(tag.ID, imageData); err != nil {
				return err
			}
		} else if imageIncluded {
			// must be unsetting
			if err := qb.DestroyImage(tag.ID); err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return tag, nil
}

func (r *mutationResolver) TagDestroy(ctx context.Context, input models.TagDestroyInput) (bool, error) {
	tagID, err := strconv.Atoi(input.ID)
	if err != nil {
		return false, err
	}

	if err := r.withTxn(ctx, func(repo models.Repository) error {
		return repo.Tag().Destroy(tagID)
	}); err != nil {
		return false, err
	}
	return true, nil
}

func (r *mutationResolver) TagsDestroy(ctx context.Context, tagIDs []string) (bool, error) {
	ids, err := utils.StringSliceToIntSlice(tagIDs)
	if err != nil {
		return false, err
	}

	if err := r.withTxn(ctx, func(repo models.Repository) error {
		qb := repo.Tag()
		for _, id := range ids {
			if err := qb.Destroy(id); err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return false, err
	}
	return true, nil
}
